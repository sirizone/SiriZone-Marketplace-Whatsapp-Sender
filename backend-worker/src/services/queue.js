const whatsappService = require('./whatsapp');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'campaign_state.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

class QueueService {
    constructor() {
        this.campaign = null;
        this.isProcessing = false;
        this.timer = null;
        this.loadState(); // Load state on startup
        
        // Check for scheduled campaigns every 30 seconds
        setInterval(() => this.checkScheduledCampaigns(), 30000);
    }

    checkScheduledCampaigns() {
        if (this.campaign && this.campaign.status === 'scheduled') {
            const now = new Date();
            const scheduledTime = new Date(this.campaign.scheduledAt);

            if (now >= scheduledTime) {
                console.log('Starting Scheduled Campaign...');
                this.campaign.status = 'running';
                this.saveState();
                this.processQueue();
            }
        }
    }

    loadState() {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = fs.readFileSync(STATE_FILE, 'utf8');
                this.campaign = JSON.parse(data);
                console.log('Campaign state loaded from disk');
                // If it was running when it crashed/stopped, set to paused so user can manually resume
                if (this.campaign && this.campaign.status === 'running') {
                    this.campaign.status = 'paused';
                    this.saveState();
                }
            }
        } catch (error) {
            console.error('Failed to load campaign state:', error);
            this.campaign = null;
        }
    }

    saveState() {
        try {
            if (this.campaign) {
                fs.writeFileSync(STATE_FILE, JSON.stringify(this.campaign, null, 2));
            } else if (fs.existsSync(STATE_FILE)) {
                fs.unlinkSync(STATE_FILE);
            }
        } catch (error) {
            console.error('Failed to save campaign state:', error);
        }
    }

    // Start or Resume a campaign
    async startCampaign(campaignData) {
        // If an old campaign exists:
        // 1. If completed, clear it.
        // 2. If paused, assume user wants to overwrite it (Auto-Stop).
        if (this.campaign) {
            if (this.campaign.status === 'completed' || this.campaign.status === 'paused') {
                console.log('Overwriting previous campaign...');
                this.campaign = null;
            }
        }

        if (this.campaign && this.campaign.id !== campaignData.id) {
             throw new Error('Another campaign is currently active (Running). Please Stop it first.');
        }

        if (!this.campaign) {
            this.campaign = {
                ...campaignData,
                currentIndex: 0,
                status: campaignData.scheduledAt ? 'scheduled' : 'running',
                logs: []
            };
        } else {
            // Resume
            this.campaign.status = campaignData.scheduledAt ? 'scheduled' : 'running';
            // Update scheduled time if provided on resume (unlikely but safe)
            if (campaignData.scheduledAt) this.campaign.scheduledAt = campaignData.scheduledAt;
        }

        this.saveState();
        
        // Only start processing immediately if NOT scheduled
        if (this.campaign.status === 'running') {
            this.processQueue();
        }
        
        return this.getStatus();
    }

    pauseCampaign() {
        if (this.campaign) {
            this.campaign.status = 'paused';
            if (this.timer) clearTimeout(this.timer);
            this.isProcessing = false;
            this.saveState();
        }
        return this.getStatus();
    }

    stopCampaign() {
        this.pauseCampaign();
        this.campaign = null;
        this.saveState(); // Will delete file
        return { status: 'stopped' };
    }

    async processQueue() {
        if (!this.campaign || this.campaign.status !== 'running' || this.isProcessing) return;

        this.isProcessing = true;

        const { messages, config, currentIndex } = this.campaign;

        if (currentIndex >= messages.length) {
            this.campaign.status = 'completed';
            this.isProcessing = false;
            this.saveState();
            console.log('Campaign Completed');
            return;
        }

        const messageData = messages[currentIndex];
        const delay = (config.minDelay + Math.random() * (config.maxDelay - config.minDelay)) * 1000;

        try {
            console.log(`Sending to ${messageData.phone} (Index: ${currentIndex})`);
            // Pass sessionId if available in config
            await whatsappService.sendMessage(messageData.phone, messageData.message, messageData.mediaUrl, config.sessionId);
            
            this.campaign.logs.push({
                phone: messageData.phone,
                status: 'sent',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`Failed to send to ${messageData.phone}`, error);
            this.campaign.logs.push({
                phone: messageData.phone,
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        this.campaign.currentIndex++;
        this.isProcessing = false;
        this.saveState(); // Save after each message

        // Schedule next message
        if (this.campaign.status === 'running') {
            this.timer = setTimeout(() => {
                this.processQueue();
            }, delay);
        }
    }

    getStatus() {
        if (!this.campaign) return { status: 'idle' };
        return {
            id: this.campaign.id,
            status: this.campaign.status,
            progress: {
                total: this.campaign.messages.length,
                sent: this.campaign.currentIndex,
                pending: this.campaign.messages.length - this.campaign.currentIndex
            },
            logs: this.campaign.logs
        };
    }
}

const queueService = new QueueService();
module.exports = queueService;
