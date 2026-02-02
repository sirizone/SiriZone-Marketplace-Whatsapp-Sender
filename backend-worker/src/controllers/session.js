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
        const { plan, code } = req.body; // 'free' or 'premium'
        
        if (plan === 'premium') {
             // Simple hardcoded activation code for manual payment verification
             // In production, this should check against a database of generated keys or payment provider
             if (code !== 'SIRIZONE-87-AED' && code !== process.env.ADMIN_CODE) {
                 return res.status(403).json({ error: 'Invalid Activation Code' });
             }
        }

        if (plan !== 'premium' && plan !== 'free') {
             return res.status(400).json({ error: 'Invalid plan. Use "free" or "premium"' });
        }
        
        db.updateSubscription(plan);
        res.json({ message: `Subscription updated to ${plan}`, subscription: db.getSubscription() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.processPayment = (req, res) => {
    try {
        const { amount, currency, paymentMethod } = req.body;
        
        // Mock Payment Gateway Validation
        // In production, this would communicate with Stripe/PayPal
        if (!amount || amount < 87) {
            return res.status(400).json({ error: 'Invalid amount. Premium costs 87 AED.' });
        }

        console.log(`Processing payment of ${amount} ${currency} via ${paymentMethod}...`);
        
        // Simulate processing delay
        setTimeout(() => {
            // Success!
            const subscription = db.updateSubscription('premium', 7); // 7 Days
            res.json({ 
                success: true, 
                message: 'Payment successful! Subscription upgraded to Premium.',
                subscription 
            });
        }, 1500);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
