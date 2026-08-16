import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { db } from "./db.js";
import { checkPassword, issueToken, requireAuth } from "./auth.js";
import { createRazorpayOrder, verifySignature } from "./payments.js";

const REQUIRED_ENV = ["JWT_SECRET", "ADMIN_PASSWORD_HASH", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"];
const RECOMMENDED_ENV = ["CLIENT_ORIGIN"];

// Validate required environment variables
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
const missingRecommended = RECOMMENDED_ENV.filter((k) => !process.env[k]);

if (missing.length || missingRecommended.length) {
  console.warn("\n" + "=".repeat(70));
  console.warn("⚠️  ENVIRONMENT CONFIGURATION WARNINGS");
  console.warn("=".repeat(70));
  
  if (missing.length) {
    console.warn(`\n❌ MISSING REQUIRED VARIABLES (server will not function correctly):`);
    missing.forEach((key) => {
      const hints = {
        JWT_SECRET: "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"",
        ADMIN_PASSWORD_HASH: "Generate with: node scripts/hash-password.js \"your-password\"",
        RAZORPAY_KEY_ID: "Get from Razorpay dashboard → Settings → API Keys",
        RAZORPAY_KEY_SECRET: "Get from Razorpay dashboard → Settings → API Keys",
      };
      console.warn(`   • ${key}: ${hints[key] || "Not configured"}`);
    });
  }
  
  if (missingRecommended.length) {
    console.warn(`\n⚠️  MISSING RECOMMENDED VARIABLES (CORS may fail in production):`);
    missingRecommended.forEach((key) => {
      if (key === "CLIENT_ORIGIN") {
        console.warn(`   • CLIENT_ORIGIN: Set to your frontend URL (e.g., https://user.github.io/repo)`);
        console.warn(`     Currently defaulting to: http://localhost:5173`);
      }
    });
  }
  
  console.warn("\n" + "=".repeat(70));
  if (missing.length) {
    console.warn("❌ Login and payment functionality will NOT work without these variables.\n");
  } else {
    console.warn("✓ Server will run, but verify CLIENT_ORIGIN is correct for production.\n");
  }
}

const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
app.use(cors({ 
  origin: allowedOrigin,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "8mb" })); // cover images arrive as base64

// Slows down password-guessing bots — a handful of tries per IP per window.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in 15 minutes." },
});

// ---------- auth ----------
app.post("/api/login", loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (!checkPassword(password)) {
    return res.status(401).json({ error: "Wrong password." });
  }
  res.json({ token: issueToken() });
});

// ---------- catalog ----------
// Reading the shelf is public. Adding/removing books requires a valid
// session token, checked on the server — never trust the browser alone.
app.get("/api/catalog", (req, res) => {
  res.json(db.getCatalog());
});

app.post("/api/catalog", requireAuth, (req, res) => {
  const b = req.body || {};
  if (!b.title || typeof b.title !== "string" || b.price == null) {
    return res.status(400).json({ error: "Title and price are required." });
  }
  const newBook = {
    id: `book-${Date.now()}`,
    title: b.title.trim(),
    author: (b.author || "Unknown").trim(),
    price: Number(b.price) || 0,
    stock: Number(b.stock) || 0,
    cover: b.cover || "",
    description: (b.description || "").trim(),
    tag: (b.tag || "").trim().toUpperCase(),
  };
  const catalog = db.getCatalog();
  catalog.unshift(newBook);
  db.saveCatalog(catalog);
  res.json(newBook);
});

app.delete("/api/catalog/:id", requireAuth, (req, res) => {
  const catalog = db.getCatalog().filter((b) => b.id !== req.params.id);
  db.saveCatalog(catalog);
  res.json({ ok: true });
});

// ---------- orders (admin only) ----------
app.get("/api/orders", requireAuth, (req, res) => {
  const orders = db.getOrders().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(orders);
});

// ---------- payments ----------
// Step 1 — the browser sends only { id, qty } pairs. Price comes from the
// server's own catalog, so a tampered client can never pay less than the
// real total.
app.post("/api/payments/create-order", async (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }
  const catalog = db.getCatalog();
  let total = 0;
  const priced = [];
  for (const { id, qty } of items) {
    const book = catalog.find((x) => x.id === id);
    if (!book) return res.status(400).json({ error: "One of your items no longer exists." });
    if (!qty || qty < 1) return res.status(400).json({ error: "Invalid quantity." });
    if (qty > book.stock) return res.status(400).json({ error: `Not enough stock for "${book.title}".` });
    total += book.price * qty;
    priced.push({ id, title: book.title, price: book.price, qty });
  }
  try {
    const rpOrder = await createRazorpayOrder(total);
    res.json({
      razorpayOrderId: rpOrder.id,
      amount: rpOrder.amount,
      currency: rpOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      items: priced,
      total,
    });
  } catch (e) {
    res.status(500).json({ error: "Couldn't start the payment. Check the server's Razorpay keys." });
  }
});

// Step 2 — after the Razorpay checkout popup reports success, the browser
// sends the signature here. Only if it verifies do we trust the payment,
// save the order, and reduce stock.
app.post("/api/payments/verify", (req, res) => {
  const {
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: signature,
    items,
    customer,
    total,
  } = req.body || {};

  if (!orderId || !paymentId || !signature) {
    return res.status(400).json({ error: "Missing payment details." });
  }
  if (!verifySignature({ orderId, paymentId, signature })) {
    return res.status(400).json({ error: "Payment could not be verified." });
  }
  if (!customer || !customer.name || !customer.phone || !customer.address) {
    return res.status(400).json({ error: "Missing delivery details." });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing order items." });
  }

  const catalog = db.getCatalog();
  for (const it of items) {
    const book = catalog.find((b) => b.id === it.id);
    if (book) {
      book.stock = Math.max(0, book.stock - it.qty);
      book.tag = book.stock === 0 ? "SOLD OUT" : book.tag === "SOLD OUT" ? "" : book.tag;
    }
  }
  db.saveCatalog(catalog);

  const order = {
    id: `order-${Date.now()}`,
    date: new Date().toISOString(),
    customer,
    items,
    total,
    paymentId,
    razorpayOrderId: orderId,
  };
  const orders = db.getOrders();
  orders.push(order);
  db.saveOrders(orders);

  res.json({ ok: true, order });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`\n✓ Manga store API running on port ${PORT}`);
  console.log(`  API endpoints: http://localhost:${PORT}/api`);
  console.log(`  Accepting requests from: ${process.env.CLIENT_ORIGIN || "http://localhost:5173"}\n`);
});
