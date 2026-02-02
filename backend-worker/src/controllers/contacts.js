const contactService = require('../services/contacts');

exports.getGroups = (req, res) => {
    try {
        const groups = contactService.getGroups();
        res.json({ groups });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createGroup = (req, res) => {
    try {
        const { name, contacts } = req.body;
        if (!name || !contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Name and contacts array required' });
        }
        const group = contactService.createGroup(name, contacts);
        res.json(group);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteGroup = (req, res) => {
    try {
        const { name } = req.params;
        const success = contactService.deleteGroup(name);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Group not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getContacts = (req, res) => {
    try {
        const { groups } = req.query; // Expects comma-separated list or multiple params
        if (!groups) {
            return res.status(400).json({ error: 'Groups parameter required' });
        }
        
        // Handle comma separated string or array
        const groupList = typeof groups === 'string' ? groups.split(',') : groups;
        
        const contacts = contactService.getGroupContacts(groupList);
        res.json({ contacts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
