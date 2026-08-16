# Pre-Launch Checklist

Use this checklist before taking real payments. Print it or check it off as you go.

## Local Development Testing

- [ ] Backend starts with `npm start` from `/server`
- [ ] Frontend starts with `npm run dev` from project root
- [ ] Catalog loads from backend without errors
- [ ] Can add items to cart
- [ ] Test payment completes (use Razorpay test card: 4111 1111 1111 1111)
- [ ] Order appears in admin panel
- [ ] Admin login works with your password
- [ ] Stock decreases after purchase

## Backend Deployment (Render)

- [ ] Render account created (render.com)
- [ ] Repo connected to Render
- [ ] Root Directory set to `server`
- [ ] Build Command: `npm install`
- [ ] Start Command: `npm start`
- [ ] Environment variables added:
  - [ ] `JWT_SECRET` - generated with random bytes
  - [ ] `ADMIN_PASSWORD_HASH` - bcrypt hashed password
  - [ ] `RAZORPAY_KEY_ID` - Test Mode (before going live)
  - [ ] `RAZORPAY_KEY_SECRET` - Test Mode (before going live)
  - [ ] `CLIENT_ORIGIN` - Your GitHub Pages URL
- [ ] Backend deployed and status is "Live"
- [ ] Can access `/api/catalog` endpoint in browser
- [ ] Render logs show "✓ Manga store API running"

## Frontend Deployment (GitHub Pages)

- [ ] Repository pushed to GitHub
- [ ] Settings → Pages → Source set to "GitHub Actions"
- [ ] Repository variable `VITE_API_URL` added with backend API URL
- [ ] GitHub Actions workflow has run successfully
- [ ] Site is live at `https://username.github.io/repo-name`
- [ ] Catalog loads (books visible)
- [ ] API errors fixed (check browser console F12)

## Integration Testing

- [ ] Frontend connects to backend without CORS errors
- [ ] Catalog displays correctly
- [ ] Can add items to cart
- [ ] Checkout process works
- [ ] Payment popup appears and is functional
- [ ] Test purchase completes successfully
- [ ] Admin can log in
- [ ] Recent order appears in admin panel

## Before Switching to Live Payments

- [ ] All tests above pass
- [ ] Understand Razorpay fees and pricing
- [ ] Have real Razorpay Live Mode keys from dashboard
- [ ] Update `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to Live Mode
- [ ] Render service redeploys after env var update
- [ ] Try a small test purchase with a real card
- [ ] Verify transaction in Razorpay dashboard
- [ ] Verify order in your admin panel
- [ ] Razorpay webhook (if configured) is receiving events

## Post-Launch Monitoring

- [ ] Check orders in admin panel regularly
- [ ] Monitor Razorpay dashboard for disputes
- [ ] Verify Render logs for errors
- [ ] Keep backups of `server/data/orders.json`
- [ ] Consider upgrading Render to paid tier to avoid sleep/inactivity

## Common Issues & Fixes

| Issue | Probable Cause | Fix |
|-------|----------------|-----|
| Blank page | API not configured | Check `VITE_API_URL` secret |
| "Can't reach server" | CORS blocked | Check `CLIENT_ORIGIN` on backend |
| Login fails | Wrong password hash | Re-run `hash-password.js` |
| Payments fail | Missing keys or test mode | Verify both keys are Live Mode |
| Orders not saving | Backend crash | Check Render logs |

## Contact & Support

- Razorpay Support: https://razorpay.com/support
- Render Support: https://render.com/docs
- GitHub Pages Help: https://docs.github.com/en/pages
