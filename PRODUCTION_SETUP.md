# Production Setup & Deployment Guide

This guide walks you through deploying the Manga Store to production with GitHub Pages (frontend) and Render (backend).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Customers                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
    ┌────────────────────────────────────────┐
    │  GitHub Pages Frontend                 │
    │  https://user.github.io/repo-name      │
    │  (Static React site)                   │
    └────────────────────┬───────────────────┘
                         │
                         ▼ API requests to
    ┌────────────────────────────────────────┐
    │  Render Backend Server                 │
    │  https://manga-store-api.onrender.com  │
    │  (Node.js + Express)                   │
    │                                        │
    │  ✓ Handles pricing & stock             │
    │  ✓ Processes Razorpay payments         │
    │  ✓ Stores orders                       │
    │  ✓ Protects admin password             │
    └────────────────────────────────────────┘
```

## Step-by-Step Deployment

### Phase 1: Prepare Your Environment (15 minutes)

#### 1.1 Create Required Credentials

**JWT Secret** (for admin session tokens):
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Copy the output. Keep it secret.

**Admin Password Hash**:
```bash
node scripts/hash-password.js "YourSecurePassword123!"
```
Copy the bcrypt hash output. Keep the plaintext password safe.

**Razorpay API Keys** (from https://dashboard.razorpay.com/#/app/settings/api-keys):
- Start with **Test Mode** keys for development/testing
- Note: Test cards: `4111 1111 1111 1111` (any future expiry, any CVV)

#### 1.2 Update Local .env for Testing

Edit `server/.env`:
```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=<your-generated-secret>
ADMIN_PASSWORD_HASH=<your-hashed-password>
RAZORPAY_KEY_ID=<test-mode-key-id>
RAZORPAY_KEY_SECRET=<test-mode-key-secret>
```

#### 1.3 Test Locally

```bash
# Terminal 1: Start backend
cd server
npm install
npm start
# Should see: ✓ Manga store API running on port 4000

# Terminal 2: Start frontend
npm install
npm run dev
# Should see: Local: http://localhost:5173
```

Test the workflow:
- Browse the catalog
- Add something to cart
- Complete checkout with test card (4111 1111 1111 1111)
- Log in as admin and verify order appears

---

### Phase 2: Deploy Backend to Render (10 minutes)

#### 2.1 Create Render Account & Service

1. Go to [render.com](https://render.com) and sign up
2. Click **New** → **Web Service**
3. Select **Connect a Repository**
4. Find and select your manga-store repo
5. Configure the service:
   - **Name**: `manga-store-api`
   - **Root Directory**: `server`
   - **Runtime**: Node.js
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

#### 2.2 Add Environment Variables

In Render's dashboard, go to **Environment** and add:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | (paste your generated secret) |
| `ADMIN_PASSWORD_HASH` | (paste your bcrypt hash) |
| `RAZORPAY_KEY_ID` | (test-mode key from dashboard) |
| `RAZORPAY_KEY_SECRET` | (test-mode secret from dashboard) |
| `CLIENT_ORIGIN` | (leave empty for now, update in 2.4) |
| `PORT` | (leave empty — Render sets this automatically) |

#### 2.3 Deploy & Get Your URL

1. Click **Deploy Service**
2. Wait for build & deployment (2-3 minutes)
3. Once "Live" appears, you'll see a URL like:
   ```
   https://manga-store-api.onrender.com
   ```
4. Copy this URL (without `/api` yet)

#### 2.4 Test Backend Endpoint

Open in your browser:
```
https://manga-store-api.onrender.com/api/catalog
```

If you see `[]` or a list of books, ✓ backend is working!

#### 2.5 Update CLIENT_ORIGIN

Now that you know your GitHub username and repo name, you can set this.

From GitHub Pages URL `https://username.github.io/repo-name`, set:
```
CLIENT_ORIGIN=https://username.github.io/repo-name
```

Update this in Render's Environment settings and redeploy.

---

### Phase 3: Deploy Frontend to GitHub Pages (10 minutes)

#### 3.1 Push to GitHub

If you haven't already:
```bash
git init
git remote add origin https://github.com/username/manga-store.git
git add .
git commit -m "Initial commit: manga store"
git push -u origin main
```

#### 3.2 Configure GitHub Pages

1. Go to your repo on GitHub
2. Settings → Pages
3. Set **Source** to **GitHub Actions**

#### 3.3 Add API URL Variable

1. Settings → Secrets and variables → Actions → **Variables**
2. Click **New repository variable**
3. Name: `VITE_API_URL`
4. Value: `https://manga-store-api.onrender.com/api` (your Render backend URL + `/api`)
5. Click **Add**

#### 3.4 Trigger Deployment

1. Go to **Actions** tab
2. Click on **Deploy frontend to GitHub Pages** workflow
3. Click **Run workflow**
4. Wait for the build to complete (2-3 minutes)

Once complete, your site is live at:
```
https://username.github.io/repo-name
```

#### 3.5 Test Frontend

1. Open https://username.github.io/repo-name
2. Verify catalog loads (should show books)
3. Try adding to cart
4. Proceed to checkout
5. Login as admin with your password to verify orders

---

### Phase 4: Switch to Live Payments (⚠️ Real Money!)

**Before switching to live payments:**
- [ ] Both frontend and backend are working in test mode
- [ ] Test payments complete successfully
- [ ] Admin login works
- [ ] Orders appear in admin panel
- [ ] You understand Razorpay pricing & fees

#### 4.1 Get Live Keys

1. In Razorpay dashboard, toggle from **Test Mode** to **Live Mode**
2. Copy your Live Mode keys (Settings → API Keys)

#### 4.2 Update Backend

In Render dashboard, update environment variables:
- `RAZORPAY_KEY_ID` = (live mode key)
- `RAZORPAY_KEY_SECRET` = (live mode secret)

Render will automatically redeploy.

#### 4.3 Verify Live Mode is Active

- Try a test purchase with a real card (small amount)
- Check Razorpay dashboard → Transactions
- Verify order appears in admin panel

---

## Troubleshooting

### Catalog won't load

**Symptoms:** Blank page or "Couldn't reach the store server"

**Fix:**
- [ ] Verify `VITE_API_URL` variable is set in GitHub secrets
- [ ] Check `CLIENT_ORIGIN` in Render matches your GitHub Pages URL exactly
- [ ] Render might be sleeping (free tier). Visit the backend URL to wake it
- [ ] Check Render logs: Dashboard → Your Service → Logs

### Login doesn't work

**Symptoms:** "Wrong password" error

**Fix:**
- [ ] Verify `ADMIN_PASSWORD_HASH` is the bcrypt hash, not plaintext
- [ ] Check you generated the hash with `node scripts/hash-password.js`
- [ ] Verify `JWT_SECRET` is set in Render environment

### Payments fail

**Symptoms:** Payment popup doesn't appear or "couldn't start payment"

**Fix:**
- [ ] Are you using Test Mode keys or Live Mode keys?
- [ ] Verify both keys are set in Render
- [ ] Check Razorpay dashboard for API errors
- [ ] Look at Render logs for payment errors

### CORS errors in browser console

**Symptoms:** "blocked by CORS policy"

**Fix:**
- [ ] Verify `CLIENT_ORIGIN` matches your frontend URL exactly (including protocol & path)
- [ ] No extra slashes: `https://user.github.io/repo` (not `https://user.github.io/repo/`)
- [ ] Test that backend responds: `curl -H "Origin: https://user.github.io/repo" https://your-backend.onrender.com/api/catalog`

### Blank page after deployment

**Symptoms:** GitHub Pages shows blank page

**Fix:**
- [ ] Check browser console (F12) for errors
- [ ] Verify `VITE_API_URL` is set correctly in secrets
- [ ] Try manually triggering workflow: Actions → Deploy workflow → Run workflow
- [ ] Check GitHub Actions log for build errors

---

## Ongoing Maintenance

### Monitoring
- Check Razorpay dashboard regularly for transactions
- Monitor Render logs for server errors
- Set up alerts in Razorpay for failed payments

### Backups
- Orders are stored in `server/data/orders.json`
- Download this regularly as backup (before switching to a real database)

### Scaling Beyond Free Tier
- Render's free tier sleeps after inactivity
- For production: upgrade Render to a paid plan
- Consider upgrading GitHub Pages to Pro (though free tier usually fine)
- Move from JSON files to a real database (PostgreSQL, MongoDB)

### Changing Admin Password
```bash
# Generate new hash
node scripts/hash-password.js "new-password"

# Update in Render environment
# ADMIN_PASSWORD_HASH = <new-hash>
# Service will redeploy automatically
```

---

## Security Checklist

- [ ] `.env` is in `.gitignore` (never committed)
- [ ] `ADMIN_PASSWORD_HASH` is bcrypt hashed, not plaintext
- [ ] `JWT_SECRET` and Razorpay keys only exist in Render, never in code
- [ ] `CLIENT_ORIGIN` restricts requests to your actual frontend URL
- [ ] HTTPS used everywhere (GitHub Pages & Render provide this)
- [ ] Rate limiting enabled on login endpoint (8 attempts per 15 min)
- [ ] Razorpay signature verification on backend (can't fake payments)

---

## Useful Links

- Razorpay Dashboard: https://dashboard.razorpay.com
- Render Dashboard: https://dashboard.render.com
- GitHub Actions Logs: Your repo → Actions → Latest workflow run
- Server Logs: Render dashboard → Your service → Logs
