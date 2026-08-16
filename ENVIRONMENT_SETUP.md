# Environment Configuration Reference

This file documents all environment variables needed for development and production.

## Frontend Environment Variables

Frontend variables are set via the build process and cannot be changed at runtime.

### Build Time Variables (GitHub Actions)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `https://manga-store-api.onrender.com/api` | Backend API endpoint for all requests |

**How to set for GitHub Pages:**
1. Go to repo Settings → Secrets and variables → Actions → **Variables**
2. Add variable `VITE_API_URL` with your backend URL

**Fallback (for local development):**
- If `VITE_API_URL` is not set, defaults to `http://localhost:4000/api`

---

## Backend Environment Variables

All backend variables must be set before the server starts.

### Required Variables (Server won't function without these)

| Variable | Example | How to Generate | Purpose |
|----------|---------|-----------------|---------|
| `JWT_SECRET` | `3a7f8c9d...` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` | Signing admin session tokens |
| `ADMIN_PASSWORD_HASH` | `$2a$12$Fj6r...` | `node scripts/hash-password.js "your-password"` | Verifying admin login (bcrypt) |
| `RAZORPAY_KEY_ID` | `rzp_test_1a2b3c...` | Razorpay Dashboard → Settings → API Keys | Razorpay Test or Live Mode ID |
| `RAZORPAY_KEY_SECRET` | `aBcDeFgH...` | Razorpay Dashboard → Settings → API Keys | Razorpay Test or Live Mode Secret |

### Recommended Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS: Only accepts requests from this URL |
| `PORT` | `4000` | Server port (usually set by hosting platform) |

### Variable Details

#### `JWT_SECRET`
- **What it is:** A cryptographic key used to sign admin login tokens
- **Security:** Must be long, random, and kept secret
- **If exposed:** Attackers can forge admin sessions
- **Changing it:** All existing admin tokens become invalid
- **Generate fresh:** `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

#### `ADMIN_PASSWORD_HASH`
- **What it is:** The bcrypt hash of your admin password
- **Why hashed:** The plaintext password is never stored or transmitted
- **Format:** Always starts with `$2a$`, `$2b$`, `$2y$`, or `$2x$`
- **Never set to:** Your plaintext password
- **If leaked:** Extremely hard to reverse, but don't share it
- **Generate:** `node scripts/hash-password.js "your-password"`
- **Verify:** Try logging in with the plaintext password you hashed

#### `CLIENT_ORIGIN`
- **What it is:** The frontend URL your backend accepts requests from
- **CORS enforcement:** All requests must come from this exact origin
- **Examples:**
  - Local: `http://localhost:5173`
  - GitHub Pages: `https://username.github.io/repo-name` (no trailing slash)
  - Custom domain: `https://my-manga-store.com`
- **Must match exactly:** Including protocol (http/https), domain, and path
- **Security:** Prevents other websites from making requests on your behalf

#### `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
- **What they are:** API credentials for Razorpay payment processing
- **Test vs Live Mode:**
  - **Test Mode:** For development/testing, doesn't charge real money
  - **Live Mode:** Processes real charges, use only when ready
- **Test card:** `4111 1111 1111 1111` (test mode only)
- **Never share:** Keep `RAZORPAY_KEY_SECRET` completely secret
- **Obtaining them:**
  1. Log in to https://dashboard.razorpay.com
  2. Settings → API Keys
  3. Copy the Key ID and Key Secret
  4. Toggle between Test Mode and Live Mode as needed

---

## Environment by Stage

### Local Development

```env
# server/.env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=<run-generate-command>
ADMIN_PASSWORD_HASH=<run-hash-password-script>
RAZORPAY_KEY_ID=<razorpay-test-key-id>
RAZORPAY_KEY_SECRET=<razorpay-test-key-secret>
```

### Production (Render Backend)

Set these in Render dashboard → Environment:

```
CLIENT_ORIGIN=https://username.github.io/repo-name
JWT_SECRET=<your-generated-secret>
ADMIN_PASSWORD_HASH=<your-bcrypt-hash>
RAZORPAY_KEY_ID=<razorpay-test-key-id>      (or live key)
RAZORPAY_KEY_SECRET=<razorpay-test-secret>  (or live secret)
```

Set in GitHub Secrets → Variables:

```
VITE_API_URL=https://manga-store-api.onrender.com/api
```

---

## Setup Workflow Checklist

### 1. Generate Secrets (Run These Locally)

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Generate ADMIN_PASSWORD_HASH
node scripts/hash-password.js "YourSecurePassword123"
```

### 2. Add to Local .env

```bash
# server/.env
JWT_SECRET=<paste-from-step-1>
ADMIN_PASSWORD_HASH=<paste-from-step-1>
```

### 3. Test Locally

```bash
cd server && npm start
# Should show: ✓ Manga store API running on port 4000
```

### 4. Get Razorpay Keys

1. Go to https://dashboard.razorpay.com
2. Settings → API Keys
3. Copy Test Mode keys (use these first)
4. Add to local `.env`

### 5. Test Payment Flow

```bash
npm run dev  # Frontend
# Try a test purchase with 4111 1111 1111 1111
```

### 6. Deploy to Render

1. Create Render service
2. Add all env variables to Render dashboard
3. Deploy

### 7. Configure GitHub Pages

1. Set `VITE_API_URL` variable to your Render backend URL
2. GitHub Actions will build and deploy automatically

### 8. Test on Production

1. Visit https://username.github.io/repo-name
2. Verify catalog loads
3. Test payment flow

### 9. Switch to Live Mode

1. Get Live Mode keys from Razorpay
2. Update Render environment variables
3. Test with real card (small amount)

---

## Troubleshooting Configuration Issues

### "Can't reach the store server"

**Check:**
1. Backend is running: Visit `https://your-backend.onrender.com/api/catalog` in browser
2. `VITE_API_URL` is set correctly in GitHub secrets
3. Backend's `CLIENT_ORIGIN` allows your frontend URL

**Fix:**
```bash
# Verify backend is working
curl https://your-backend.onrender.com/api/catalog

# Check if it's a CORS issue - look at browser Network tab (F12)
# Error message like "blocked by CORS" means CLIENT_ORIGIN mismatch
```

### "Wrong password" on admin login

**Check:**
1. Is `ADMIN_PASSWORD_HASH` a bcrypt hash (starts with `$2`)?
2. Did you use the plaintext password, not the hash?

**Fix:**
```bash
# Generate fresh hash
node scripts/hash-password.js "your-password"

# Update ADMIN_PASSWORD_HASH in Render or local .env
# Use the full hash output, not just part of it
```

### "Couldn't start the payment" / Razorpay errors

**Check:**
1. Are `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` set?
2. Are you using Test Mode keys or Live Mode keys?
3. Is the format correct (no extra spaces or newlines)?

**Fix:**
```bash
# Verify Render has the keys
# Check Render logs: Dashboard → Your Service → Logs
# Look for Razorpay API error messages

# Make sure keys match your dashboard exactly
# Copy-paste carefully - extra spaces will break authentication
```

### CORS Errors in Browser Console

**Error:** "blocked by CORS policy"

**Check:**
1. What is your frontend URL? (e.g., `https://user.github.io/my-repo`)
2. Is `CLIENT_ORIGIN` on backend exactly this?
3. No trailing slashes? No extra spaces?

**Fix:**
```bash
# Frontend URL should be: https://username.github.io/repo-name
# NOT: https://username.github.io/repo-name/
# NOT: https://username.github.io (if repo-name is needed)

# Update CLIENT_ORIGIN in Render exactly as above
# Redeploy Render service
# Clear browser cache and reload
```

---

## Security Best Practices

✅ **DO:**
- [ ] Generate strong, random `JWT_SECRET`
- [ ] Use bcrypt hash for `ADMIN_PASSWORD_HASH` (always)
- [ ] Keep all env variables in `.gitignore` (never commit)
- [ ] Use Test Mode keys first, Live Mode only when ready
- [ ] Rotate secrets regularly (change password, generate new JWT_SECRET)
- [ ] Use HTTPS everywhere (GitHub Pages & Render both provide this)

❌ **DON'T:**
- [ ] Never commit `.env` files to git
- [ ] Never put plaintext passwords anywhere
- [ ] Never put `RAZORPAY_KEY_SECRET` in frontend code
- [ ] Never log sensitive variables
- [ ] Never share your env variables (even in screenshots)
- [ ] Never use the same JWT_SECRET across environments

---

## FAQ

**Q: Can I use the same JWT_SECRET for dev and production?**
A: No. Generate a separate, unique secret for each environment.

**Q: What if I leak my Razorpay key?**
A: Go to Razorpay dashboard and regenerate the keys immediately.

**Q: How often should I change the admin password?**
A: At least every 6 months, immediately if you suspect compromise.

**Q: Can I test payments without using real cards?**
A: Yes, Razorpay Test Mode lets you use test card `4111 1111 1111 1111` without charges.

**Q: What if I forget the admin password?**
A: Generate a new hash with `node scripts/hash-password.js "new-password"` and update it.

**Q: How do I know if my variables are set correctly?**
A: Check Render logs when server starts. It lists which variables are missing.
