# Vercel Deployment Guide

This project is split into two parts:
1. **Frontend** (`frontend-vercel`): Next.js application (Deploys to Vercel).
2. **Backend** (`backend-worker`): Express.js + WhatsApp Web.js (Requires persistent hosting, e.g., VPS, Railway, or Local Machine).

## 🚀 Part 1: Deploying Frontend to Vercel

1. **Push to GitHub**: Ensure your code is pushed to the `main` branch.
2. **Import Project in Vercel**:
   - Go to your Vercel Dashboard -> "Add New Project".
   - Select your GitHub repository.
3. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: Click "Edit" and select `frontend-vercel`.
4. **Environment Variables**:
   Add the following variables in the Vercel deployment settings:
   - `WORKER_API_KEY`: `secret-api-key-123` (Must match the one in `backend-worker/.env`)
   - `WORKER_URL`: The public URL of your backend.
     - *If testing locally:* Use a tunnel URL (see Part 3).
     - *If hosted on VPS:* Use `http://your-vps-ip:3001` or your domain.

5. **Deploy**: Click "Deploy".

---

## 🛠 Part 2: Backend Hosting (Important)

The backend **CANNOT** run on Vercel because it requires:
- A persistent browser instance (Puppeteer).
- Local file system access (to save WhatsApp sessions).

### Option A: Run Locally (For Testing)
To make your Vercel app talk to your local computer:
1. Start the backend:
   ```bash
   cd backend-worker
   npm run dev
   ```
2. Use **ngrok** to expose port 3001:
   ```bash
   npx ngrok http 3001
   ```
3. Copy the `https://....ngrok-free.app` URL.
4. Update the `WORKER_URL` in your Vercel Project Settings to this ngrok URL.
5. Redeploy (or wait for the environment variable to propagate).

### Option B: Deploy to VPS / Railway (For Production)
Deploy the `backend-worker` folder to a service that supports persistent storage (like Railway with a volume, or a DigitalOcean Droplet).

---

## ✅ Checklist for "Working Well"
- [ ] Backend is running and has a public URL.
- [ ] Vercel `WORKER_URL` is set correctly (no trailing slash is best, e.g., `https://my-backend.com`).
- [ ] `WORKER_API_KEY` matches on both sides.
