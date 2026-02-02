const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign');
const contactController = require('../controllers/contacts');
const sessionController = require('../controllers/session');

// Middleware to check API Key
const checkApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
};

router.use(checkApiKey);

router.get('/status', campaignController.getSystemStatus);
router.post('/campaign/start', campaignController.startCampaign);
router.post('/campaign/pause', campaignController.pauseCampaign);
router.post('/campaign/stop', campaignController.stopCampaign);
router.get('/campaign/status', campaignController.getCampaignStatus);

// Session Management Routes
router.get('/sessions', sessionController.getSessions);
router.post('/sessions', sessionController.createSession);
router.delete('/sessions/:id', sessionController.removeSession);
router.get('/subscription', sessionController.getSubscription);
router.post('/subscription/upgrade', sessionController.upgradeSubscription);
router.post('/subscription/payment', sessionController.processPayment);

// Contact Group Routes
router.get('/contacts/groups', contactController.getGroups);
router.post('/contacts/groups', contactController.createGroup);
router.delete('/contacts/groups/:name', contactController.deleteGroup);
router.get('/contacts/list', contactController.getContacts);

module.exports = router;
