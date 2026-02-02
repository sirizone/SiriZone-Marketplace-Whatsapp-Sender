const whatsappService = require('../services/whatsapp');
const db = require('../services/db');

exports.getSessions = (req, res) => {
    try {
        const sessions = whatsappService.getAllSessions();
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createSession = (req, res) => {
    try {
        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Session ID is required' });
        }
        
        // This will throw if limit reached
        whatsappService.createSession(id);
        
        // Return immediately, QR code will be available via getSessions shortly
        res.json({ message: 'Session creation started', id });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.removeSession = async (req, res) => {
    try {
        const { id } = req.params;
        await whatsappService.removeSession(id);
        res.json({ message: 'Session removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getSubscription = (req, res) => {
    try {
        const subscription = db.getSubscription();
        res.json(subscription);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.upgradeSubscription = (req, res) => {
    try {
        // In a real app, this would verify payment
        // For now, we just toggle to premium
        const { plan } = req.body; // 'free' or 'premium'
        if (plan !== 'premium' && plan !== 'free') {
             return res.status(400).json({ error: 'Invalid plan. Use "free" or "premium"' });
        }
        
        db.updateSubscription(plan);
        res.json({ message: `Subscription updated to ${plan}`, subscription: db.getSubscription() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
