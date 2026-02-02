const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../../data/contacts.json');

class ContactService {
    constructor() {
        this.ensureDataFile();
    }

    ensureDataFile() {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({ groups: {} }, null, 2));
        }
    }

    readData() {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (err) {
            return { groups: {} };
        }
    }

    writeData(data) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    }

    getGroups() {
        const data = this.readData();
        // Return array of { name, count }
        return Object.keys(data.groups).map(name => ({
            name,
            count: data.groups[name].length
        }));
    }

    createGroup(name, contacts) {
        const data = this.readData();
        if (data.groups[name]) {
            throw new Error('Group already exists');
        }
        // Deduplicate contacts by phone
        const uniqueContacts = Array.from(new Map(contacts.map(c => [c.phone, c])).values());
        
        data.groups[name] = uniqueContacts;
        this.writeData(data);
        return { name, count: uniqueContacts.length };
    }

    deleteGroup(name) {
        const data = this.readData();
        if (data.groups[name]) {
            delete data.groups[name];
            this.writeData(data);
            return true;
        }
        return false;
    }

    getGroupContacts(names) {
        const data = this.readData();
        let allContacts = [];
        
        // names can be a string (single group) or array of strings
        const groupNames = Array.isArray(names) ? names : [names];

        groupNames.forEach(name => {
            if (data.groups[name]) {
                allContacts = [...allContacts, ...data.groups[name]];
            }
        });

        // Deduplicate merged contacts
        return Array.from(new Map(allContacts.map(c => [c.phone, c])).values());
    }
}

module.exports = new ContactService();
