# WhatsApp Worker Backend

## Deployment Guide

This backend service uses `whatsapp-web.js` which relies on Puppeteer (Chrome). 

### Recommended Deployment Platforms
- **Railway / Render / DigitalOcean App Platform**: These platforms support long-running processes and Docker/Puppeteer.
- **VPS (Ubuntu/Debian)**: Run using PM2 or Docker.

### ⚠️ Vercel / AWS Lambda Warning
This application is **NOT suitable for Vercel Serverless Functions** because:
1. It requires a persistent connection to WhatsApp (WebSocket).
2. It requires a persistent filesystem to store session data (`.wwebjs_auth`) and local database (`data/`).
3. Puppeteer requires specific system dependencies often missing in standard serverless environments.

### Environment Variables
Ensure these are set in your production environment:
- `API_KEY`: Your secret key for securing endpoints.
- `PORT`: (Optional) Port to run on (default 3001).

### Running in Production
```bash
npm install
npm start
```
