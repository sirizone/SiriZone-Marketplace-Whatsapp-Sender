const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data.json');

// Default Data
const defaultData = {
    subscription: {
        plan: 'free', // 'free' or 'premium'
        expiry: null,
        messageCount: 0,
        maxMessages: 1000,
        maxAccounts: 1
    },
    sessions: [] // List of session IDs
};

class DBService {
    constructor() {
        this.data = defaultData;
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DB_PATH)) {
                this.data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            } else {
                this.save();
            }
        } catch (err) {
            console.error('Failed to load DB:', err);
            this.data = defaultData;
        }
    }

    save() {
        try {
            fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2));
        } catch (err) {
            console.error('Failed to save DB:', err);
        }
    }

    getSubscription() {
        return this.data.subscription;
    }

    updateSubscription(plan) {
        if (plan === 'premium') {
            this.data.subscription.plan = 'premium';
            this.data.subscription.maxMessages = Infinity;
            this.data.subscription.maxAccounts = Infinity;
        } else {
            this.data.subscription.plan = 'free';
            this.data.subscription.maxMessages = 1000;
            this.data.subscription.maxAccounts = 1;
        }
        this.save();
        return this.data.subscription;
    }

    incrementMessageCount(count = 1) {
        this.data.subscription.messageCount += count;
        this.save();
    }

    resetMessageCount() {
        this.data.subscription.messageCount = 0;
        this.save();
    }

    getSessions() {
        return this.data.sessions;
    }

    addSession(id) {
        if (!this.data.sessions.includes(id)) {
            this.data.sessions.push(id);
            this.save();
        }
    }

    removeSession(id) {
        this.data.sessions = this.data.sessions.filter(s => s !== id);
        this.save();
    }

    canSendMessage() {
        const { plan, messageCount, maxMessages } = this.data.subscription;
        if (plan === 'premium') return true;
        return messageCount < maxMessages;
    }

    canAddAccount() {
        const { plan, maxAccounts } = this.data.subscription;
        const currentAccounts = this.data.sessions.length;
        if (plan === 'premium') return true;
        return currentAccounts < maxAccounts;
    }
}

module.exports = new DBService();
