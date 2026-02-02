const queueService = require('../services/queue');
const whatsappService = require('../services/whatsapp');
const db = require('../services/db');

exports.getSystemStatus = (req, res) => {
    const sessions = whatsappService.getAllSessions();
    const subscription = db.getSubscription();
    const campaignStatus = queueService.getStatus();
    res.json({
        sessions,
        subscription,
        campaign: campaignStatus
    });
};

exports.startCampaign = async (req, res) => {
    try {
        const { id, messages, config } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Invalid messages array' });
        }
        
        // Default config
        const campaignConfig = {
            minDelay: config?.minDelay || 5, // seconds
            maxDelay: config?.maxDelay || 10, // seconds
            ...config
        };

        const status = await queueService.startCampaign({ id, messages, config: campaignConfig });
        res.json(status);
    } catch (error) {
        console.error('Start Campaign Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.pauseCampaign = (req, res) => {
    const status = queueService.pauseCampaign();
    res.json(status);
};

exports.stopCampaign = (req, res) => {
    const status = queueService.stopCampaign();
    res.json(status);
};

exports.getCampaignStatus = (req, res) => {
    const status = queueService.getStatus();
    res.json(status);
};
