# WhatsApp Bulk Sender - Deployment Guide

## 🚨 CRITICAL ARCHITECTURE CONCEPT
This application has **Two Parts**:
1. **Frontend (Vercel)**: The User Interface (Next.js).
2. **Backend Worker (Node.js)**: The engine that runs WhatsApp (Puppeteer/Chrome).

### ❌ Common Mistake (The "502 Error")
If you deploy the Frontend to Vercel but keep the Worker on your laptop:
- **IT WILL NOT WORK.**
- Vercel (Cloud) cannot see `localhost:3001` (Your Laptop).
- You will get a `502 Bad Gateway` error.

### ✅ How to Run It Correctly

#### Option 1: Local Development (Easiest)
Run **BOTH** on your computer.
1. Backend: `npm run dev` (Runs on port 3001)
2. Frontend: `npm run dev` (Runs on port 3000)
3. **Open:** `http://localhost:3000`
4. **Do NOT** use the Vercel URL.

#### Option 2: Production Deployment (Recommended)
1. **Frontend**: Deploy to Vercel.
2. **Backend**: You **MUST** buy a VPS (Virtual Private Server) from DigitalOcean, AWS, or Hetzner (~$5/mo).
   - WhatsApp needs a persistent server running 24/7.
   - Serverless (Vercel/Netlify) **cannot** run WhatsApp because they kill the process after 10 seconds.
3. **Connect Them**:
   - In Vercel Project Settings -> Environment Variables:
   - Set `WORKER_URL` to your VPS IP (e.g., `http://123.45.67.89:3001`).

#### Option 3: Hybrid (Ngrok Tunnel) - Good for Demos
If you want to use the Vercel URL but run the worker on your laptop:
1. Install Ngrok: `npm install -g ngrok`
2. Run: `ngrok http 3001`
3. Copy the URL (e.g., `https://random-name.ngrok-free.app`)
4. Go to Vercel Dashboard -> Settings -> Environment Variables.
5. Update `WORKER_URL` to the Ngrok URL.
6. Redeploy/Restart Vercel.

---

## 📂 Project Structure
- `frontend-vercel/`: Next.js App Router (The Dashboard)
- `backend-worker/`: Express + WhatsApp-Web.js (The Engine)

## 🚀 Deployment Steps

### 1. Backend (VPS)
1. Rent a VPS (Ubuntu 22.04 recommended).
2. SSH into it: `ssh root@your-ip`
3. Install Node.js 18+:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Install Chrome dependencies (Puppeteer needs these):
   ```bash
   sudo apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils
   ```
5. Clone/Copy your code.
6. Install dependencies: `npm install`
7. Start with PM2 (Process Manager):
   ```bash
   npm install -g pm2
   pm2 start src/app.js --name "whatsapp-worker"
   pm2 save
   pm2 startup
   ```

### 2. Frontend (Vercel)
1. Push `frontend-vercel` folder to GitHub.
2. Import project in Vercel.
3. Add Environment Variables:
   - `WORKER_API_KEY`: (Same as backend)
   - `WORKER_URL`: `http://YOUR_VPS_IP:3001`
   - `BLOB_READ_WRITE_TOKEN`: (If using Vercel Blob for media)
