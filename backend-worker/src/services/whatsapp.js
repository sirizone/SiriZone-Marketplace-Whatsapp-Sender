const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const EventEmitter = require('events');
const db = require('./db');

class WhatsAppSession extends EventEmitter {
    constructor(id) {
        super();
        this.id = id;
        this.client = null;
        this.qrCodeUrl = null;
        this.status = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, CONNECTED
        this.initialize();
    }

    initialize() {
        if (this.client) return; // Prevent double initialization

        console.log(`[${this.id}] Initializing WhatsApp Client...`);
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: this.id, dataPath: './whatsapp_sessions' }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        this.client.on('qr', async (qr) => {
            console.log(`[${this.id}] QR RECEIVED`);
            this.status = 'QR_READY';
            this.qrCodeUrl = await qrcode.toDataURL(qr);
            this.emit('qr', this.qrCodeUrl);
        });

        this.client.on('ready', () => {
            console.log(`[${this.id}] WhatsApp Client is ready!`);
            this.status = 'CONNECTED';
            this.qrCodeUrl = null;
            this.emit('ready');
        });

        this.client.on('authenticated', () => {
            console.log(`[${this.id}] Authenticated`);
            this.status = 'AUTHENTICATED';
        });

        this.client.on('auth_failure', (msg) => {
            console.error(`[${this.id}] AUTHENTICATION FAILURE`, msg);
            this.status = 'AUTH_FAILURE';
        });

        this.client.on('disconnected', (reason) => {
            console.log(`[${this.id}] Client was logged out`, reason);
            this.status = 'DISCONNECTED';
            this.qrCodeUrl = null;
            this.emit('disconnected');
            // Optional: Reinitialize or wait for manual restart
            // this.initialize(); 
        });

        this.client.initialize();
    }

    async sendMessage(to, message, mediaUrl = null) {
        if (this.status !== 'CONNECTED') {
            throw new Error('WhatsApp client is not connected');
        }

        // Format number (remove + and spaces, ensure @c.us)
        const formattedNumber = to.replace(/[^\d]/g, '') + '@c.us';

        try {
            if (mediaUrl) {
                console.log(`[${this.id}] Fetching media from: ${mediaUrl}`);
                const media = await MessageMedia.fromUrl(mediaUrl);
                console.log(`[${this.id}] Media loaded: ${media.mimetype}, Size: ${media.data.length} chars`);
                
                // Detect audio/voice note
                const options = { caption: message };
                if (media.mimetype.startsWith('audio/')) {
                    console.log(`[${this.id}] Detected audio, attempting to send as voice note`);
                    try {
                        options.sendAudioAsVoice = true; // Try sending as PTT
                        return await this.client.sendMessage(formattedNumber, media, options);
                    } catch (voiceError) {
                        console.warn(`[${this.id}] Failed to send as voice note, falling back to audio file`, voiceError);
                        options.sendAudioAsVoice = false; // Fallback to regular audio
                        return await this.client.sendMessage(formattedNumber, media, options);
                    }
                }

                return await this.client.sendMessage(formattedNumber, media, options);
            } else {
                return await this.client.sendMessage(formattedNumber, message);
            }
        } catch (error) {
            console.error(`[${this.id}] Failed to send to ${to}`, error);
            throw error;
        }
    }

    getStatus() {
        return {
            id: this.id,
            status: this.status,
            qrCodeUrl: this.qrCodeUrl
        };
    }

    async destroy() {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
        }
    }
}

class SessionManager extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map();
        this.initSavedSessions();
    }

    initSavedSessions() {
        const savedSessions = db.getSessions();
        if (savedSessions.length === 0) {
            // Create default session if none exists
            this.createSession('session_02');
        } else {
            savedSessions.forEach(id => {
                try {
                    this.createSession(id);
                } catch (err) {
                    console.error(`Failed to restore session ${id}:`, err.message);
                }
            });
        }
    }

    createSession(id) {
        if (this.sessions.has(id)) {
            return this.sessions.get(id);
        }

        const isRestoring = db.getSessions().includes(id);
        if (!isRestoring && !db.canAddAccount()) {
            throw new Error('Maximum accounts reached. Upgrade to Premium.');
        }

        const session = new WhatsAppSession(id);
        this.sessions.set(id, session);
        db.addSession(id);

        session.on('qr', () => this.emit('update'));
        session.on('ready', () => this.emit('update'));
        session.on('disconnected', () => this.emit('update'));

        return session;
    }

    async removeSession(id) {
        if (this.sessions.has(id)) {
            const session = this.sessions.get(id);
            await session.destroy();
            this.sessions.delete(id);
            db.removeSession(id);
            this.emit('update');
        }
    }

    getSession(id) {
        return this.sessions.get(id);
    }

    getAllSessions() {
        return Array.from(this.sessions.values()).map(s => s.getStatus());
    }

    // Helper to send message using a specific session, or the first connected one
    async sendMessage(to, message, mediaUrl = null, sessionId = null) {
        if (!db.canSendMessage()) {
            throw new Error('Message limit reached. Upgrade to Premium to send more messages.');
        }

        let session;
        if (sessionId) {
            session = this.sessions.get(sessionId);
        } else {
            // Find first connected session
            session = Array.from(this.sessions.values()).find(s => s.status === 'CONNECTED');
        }

        if (!session) {
            throw new Error('No connected WhatsApp session available');
        }

        const result = await session.sendMessage(to, message, mediaUrl);
        db.incrementMessageCount();
        return result;
    }
}

const sessionManager = new SessionManager();
module.exports = sessionManager;
