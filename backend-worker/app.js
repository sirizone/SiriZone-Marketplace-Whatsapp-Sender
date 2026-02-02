require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./src/routes/api');
const whatsappService = require('./src/services/whatsapp');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for campaign data
app.use(express.urlencoded({ extended: true }));

// Basic Health Check (No Auth)
app.get('/', (req, res) => {
    res.send('WhatsApp Worker is Running');
});

// API Routes
app.use('/api', apiRoutes);

app.listen(PORT, () => {
    console.log(`Worker Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (whatsappService.client) {
        await whatsappService.client.destroy();
    }
    process.exit(0);
});
