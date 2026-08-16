import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

const BLANK_FORM = { title: "", author: "", price: "", stock: "", cover: "", description: "", tag: "" };
const BLANK_CUSTOMER = { name: "", phone: "", address: "", email: "" };
const TOKEN_KEY = "manga_admin_token";

// Indian rupee formatting, e.g. ₹1,299.00
const formatPrice = (n) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Resize + compress an uploaded image client-side before sending it as a
// base64 data URL, so covers stay reasonably small.
function fileToCompressedDataUrl(file, maxDim = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

function Stamp({ children, tone = "red" }) {
  return (
    <span
      style={{
        display: "inline-block",
        border: `2px solid ${tone === "red" ? "#C1272D" : "#17181C"}`,
        color: tone === "red" ? "#C1272D" : "#17181C",
        borderRadius: "9999px",
        padding: "2px 10px",
        fontFamily: "'Rampart One', system-ui",
        fontSize: "11px",
        letterSpacing: "0.05em",
        transform: "rotate(-8deg)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Halftone({ style }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: "radial-gradient(#17181C 1px, transparent 1.4px)",
        backgroundSize: "8px 8px",
        opacity: 0.06,
        ...style,
      }}
    />
  );
}

export default function MangaStore() {
  const [view, setView] = useState("shop"); // shop | admin-login | admin
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [cart, setCart] = useState({}); // id -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [orderStamp, setOrderStamp] = useState(false);

  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || "");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [form, setForm] = useState(BLANK_FORM);
  const [formMsg, setFormMsg] = useState("");
  const [formError, setFormError] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState("");

  const [checkoutStep, setCheckoutStep] = useState("cart"); // cart | details
  const [customer, setCustomer] = useState(BLANK_CUSTOMER);
  const [customerError, setCustomerError] = useState("");
  const [paying, setPaying] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const books = await api.getCatalog();
      setCatalog(books);
    } catch (e) {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
      setLoadError(`Couldn't reach the store server at ${apiUrl}. Please check the server is running and the API URL is correctly configured.`);
      setCatalog([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setAdminToken("");
    setView("shop");
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const list = await api.getOrders(adminToken);
      setOrders(list);
    } catch (e) {
      setOrdersError(e.message || "Couldn't load orders.");
      if (String(e.message).toLowerCase().includes("session")) logout();
    }
    setOrdersLoading(false);
  }, [adminToken, logout]);

  useEffect(() => {
    if (view === "admin" && adminToken) loadOrders();
  }, [view, adminToken, loadOrders]);

  // ---- cart ----
  const addToCart = (book) => {
    if (book.stock <= 0) return;
    setCart((c) => {
      const current = c[book.id] || 0;
      if (current >= book.stock) return c;
      return { ...c, [book.id]: current + 1 };
    });
  };
  const removeFromCart = (id) => {
    setCart((c) => {
      const next = { ...c };
      if (!next[id]) return c;
      next[id] -= 1;
      if (next[id] <= 0) delete next[id];
      return next;
    });
  };
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = catalog
    ? Object.entries(cart).reduce((sum, [id, qty]) => {
        const b = catalog.find((x) => x.id === id);
        return b ? sum + b.price * qty : sum;
      }, 0)
    : 0;

  const goToCheckout = () => {
    if (cartCount === 0) return;
    setCustomerError("");
    setCheckoutStep("details");
  };

  // ---- payment ----
  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  const placeOrder = async (e) => {
    e.preventDefault();
    if (cartCount === 0) return;
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      setCustomerError("Name, phone, and delivery address are required.");
      return;
    }
    setCustomerError("");
    setPaying(true);

    const loaded = await loadRazorpay();
    if (!loaded) {
      setCustomerError("Payment system didn't load. Check your connection and reload the page.");
      setPaying(false);
      return;
    }

    let order;
    try {
      const items = Object.entries(cart).map(([id, qty]) => ({ id, qty }));
      order = await api.createPaymentOrder(items);
    } catch (err) {
      setCustomerError(err.message || "Couldn't start the payment.");
      setPaying(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.razorpayOrderId,
      name: "Kamidamashii",
      description: "Manga order",
      prefill: {
        name: customer.name.trim(),
        contact: customer.phone.trim(),
        email: customer.email.trim(),
      },
      theme: { color: "#C1272D" },
      handler: async (response) => {
        try {
          await api.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            items: order.items,
            total: order.total,
            customer: {
              name: customer.name.trim(),
              phone: customer.phone.trim(),
              address: customer.address.trim(),
              email: customer.email.trim(),
            },
          });
          await loadCatalog(); // reflect updated stock
          setCart({});
          setCustomer(BLANK_CUSTOMER);
          setCheckoutStep("cart");
          setCartOpen(false);
          setOrderStamp(true);
          setTimeout(() => setOrderStamp(false), 2200);
        } catch (err) {
          setCustomerError(
            (err.message || "Payment succeeded but the order couldn't be confirmed.") +
              " Payment ID: " + response.razorpay_payment_id
          );
        }
        setPaying(false);
      },
      modal: {
        ondismiss: () => setPaying(false),
      },
    });

    rzp.on("payment.failed", () => {
      setCustomerError("Payment failed. No charge was made — you can try again.");
      setPaying(false);
    });

    rzp.open();
  };

  // ---- admin ----
  const tryLogin = async (e) => {
    e.preventDefault();
    setPwError("");
    setPwLoading(true);
    try {
      const { token } = await api.login(pw);
      sessionStorage.setItem(TOKEN_KEY, token);
      setAdminToken(token);
      setPw("");
      setView("admin");
    } catch (err) {
      setPwError(err.message || "Wrong password.");
    }
    setPwLoading(false);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImgError("Please choose an image file.");
      return;
    }
    setImgError("");
    setImgLoading(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setForm((f) => ({ ...f, cover: dataUrl }));
    } catch (err) {
      setImgError("Couldn't process that image — try a different file.");
    }
    setImgLoading(false);
  };

  const submitBook = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.price) {
      setFormError("Title and price are required.");
      return;
    }
    try {
      const newBook = await api.addBook(
        {
          title: form.title.trim(),
          author: form.author.trim(),
          price: parseFloat(form.price) || 0,
          stock: parseInt(form.stock, 10) || 0,
          cover: form.cover,
          description: form.description.trim(),
          tag: form.tag.trim(),
        },
        adminToken
      );
      setCatalog((prev) => [newBook, ...(prev || [])]);
      setForm(BLANK_FORM);
      setFormMsg(`Added "${newBook.title}" to the shelf.`);
      setTimeout(() => setFormMsg(""), 2500);
    } catch (err) {
      setFormError(err.message || "Couldn't add that book.");
      if (String(err.message).toLowerCase().includes("session")) logout();
    }
  };

  const deleteBook = async (id) => {
    try {
      await api.deleteBook(id, adminToken);
      setCatalog((prev) => (prev || []).filter((b) => b.id !== id));
    } catch (err) {
      setFormError(err.message || "Couldn't remove that book.");
      if (String(err.message).toLowerCase().includes("session")) logout();
    }
  };

  const inkFont = "'Zen Kaku Gothic New', 'Noto Sans JP', system-ui, sans-serif";
  const displayFont = "'Rampart One', system-ui, sans-serif";

  return (
    <div style={{ minHeight: "100vh", background: "#F3EFE4", color: "#17181C", fontFamily: inkFont, position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rampart+One&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; font-family: inherit; }
        .panel-btn:hover .cover-inner { transform: translate(-3px,-3px); box-shadow: 6px 6px 0 #17181C; }
        .scanlines::before {
          content: "";
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, rgba(23,24,28,0.035) 0px, rgba(23,24,28,0.035) 1px, transparent 1px, transparent 3px);
          pointer-events: none;
        }
      `}</style>

      {/* ---------- HEADER ---------- */}
      <header style={{ borderBottom: "4px solid #17181C", background: "#17181C", color: "#F3EFE4", padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20 }}>
        <button onClick={() => setView("shop")} style={{ background: "none", border: "none", color: "#F3EFE4", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: displayFont, fontSize: "26px", letterSpacing: "0.03em" }}>紙魂</span>
          <span style={{ fontFamily: displayFont, fontSize: "20px", letterSpacing: "0.04em" }}>KAMIDAMASHII</span>
        </button>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          {view !== "admin" && view !== "admin-login" && (
            <button onClick={() => setView(adminToken ? "admin" : "admin-login")} style={{ background: "none", border: "1px solid #F3EFE4", color: "#F3EFE4", padding: "6px 12px", borderRadius: 3, fontSize: 13 }}>
              Shelf keeper
            </button>
          )}
          {view === "admin" && (
            <>
              <button onClick={() => setView("shop")} style={{ background: "none", border: "1px solid #F3EFE4", color: "#F3EFE4", padding: "6px 12px", borderRadius: 3, fontSize: 13 }}>
                View shop
              </button>
              <button onClick={logout} style={{ background: "#C1272D", border: "none", color: "#F3EFE4", padding: "6px 12px", borderRadius: 3, fontSize: 13 }}>
                Log out
              </button>
            </>
          )}
          {view === "shop" && (
            <button onClick={() => setCartOpen(true)} style={{ background: "#C1272D", border: "none", color: "#F3EFE4", padding: "6px 14px", borderRadius: 3, fontSize: 13, position: "relative" }}>
              Cart {cartCount > 0 && `(${cartCount})`}
            </button>
          )}
        </div>
      </header>

      {loadError && (
        <div style={{ background: "#C1272D", color: "#F3EFE4", padding: "8px 20px", fontSize: 13, textAlign: "center" }}>
          {loadError}
        </div>
      )}

      {/* ---------- SHOP VIEW ---------- */}
      {view === "shop" && (
        <main className="scanlines" style={{ position: "relative", padding: "36px 20px 80px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 12, letterSpacing: "0.2em", color: "#8A8478", margin: 0 }}>VOLUME CATALOG · PRINTED IN LIMITED RUN</p>
            <h1 style={{ fontFamily: displayFont, fontSize: "clamp(28px, 5vw, 44px)", margin: "6px 0 0", lineHeight: 1.15 }}>This week's shelf</h1>
          </div>

          {loading && <p>Loading the shelf…</p>}

          {!loading && catalog && catalog.length === 0 && !loadError && (
            <div style={{ border: "2px dashed #B9B4A6", borderRadius: 4, padding: 40, textAlign: "center", color: "#6b665b" }}>
              The shelf is empty right now. Check back soon.
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 22 }}>
            {catalog && catalog.map((book) => (
              <button key={book.id} className="panel-btn" onClick={() => setSelected(book)} style={{ background: "none", border: "none", textAlign: "left", padding: 0 }}>
                <div className="cover-inner" style={{ border: "3px solid #17181C", borderRadius: 2, background: book.cover ? `url(${book.cover}) center/cover` : "#e7e1d2", aspectRatio: "3/4", position: "relative", transition: "transform 0.15s ease, box-shadow 0.15s ease", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                  {!book.cover && <Halftone />}
                  {!book.cover && (
                    <span style={{ position: "absolute", top: "42%", left: 0, right: 0, textAlign: "center", fontFamily: displayFont, fontSize: 15, color: "#8A8478", padding: "0 10px" }}>
                      {book.title}
                    </span>
                  )}
                  {book.tag && (
                    <div style={{ position: "absolute", top: 10, right: 10 }}>
                      <Stamp tone={book.tag === "SOLD OUT" ? "black" : "red"}>{book.tag}</Stamp>
                    </div>
                  )}
                  <div style={{ background: "rgba(243,239,228,0.92)", width: "100%", padding: "8px 10px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>{book.title}</div>
                    <div style={{ fontSize: 12, color: "#6b665b" }}>{book.author}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>{formatPrice(book.price)}</span>
                  <span style={{ color: book.stock > 0 ? "#6b665b" : "#C1272D" }}>{book.stock > 0 ? `${book.stock} in stock` : "sold out"}</span>
                </div>
              </button>
            ))}
          </div>
        </main>
      )}

      {/* ---------- BOOK DETAIL MODAL ---------- */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(23,24,28,0.7)", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#F3EFE4", border: "3px solid #17181C", maxWidth: 480, width: "100%", padding: 24, position: "relative" }}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 10, right: 14, background: "none", border: "none", fontSize: 20 }}>×</button>
            <p style={{ fontSize: 12, letterSpacing: "0.15em", color: "#8A8478", margin: 0 }}>{selected.author.toUpperCase()}</p>
            <h2 style={{ fontFamily: displayFont, fontSize: 26, margin: "6px 0 12px" }}>{selected.title}</h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#3a372f" }}>{selected.description || "No description yet."}</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
              <span style={{ fontFamily: displayFont, fontSize: 22 }}>{formatPrice(selected.price)}</span>
              <button
                disabled={selected.stock <= 0}
                onClick={() => { addToCart(selected); setSelected(null); setCartOpen(true); }}
                style={{ background: selected.stock > 0 ? "#C1272D" : "#B9B4A6", color: "#F3EFE4", border: "none", padding: "10px 18px", borderRadius: 3, fontWeight: 700 }}
              >
                {selected.stock > 0 ? "Add to cart" : "Sold out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- CART DRAWER ---------- */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={() => { if (!paying) { setCartOpen(false); setCheckoutStep("cart"); } }} style={{ position: "absolute", inset: 0, background: "rgba(23,24,28,0.6)" }} />
          <div style={{ position: "relative", width: "min(380px, 100%)", background: "#F3EFE4", height: "100%", padding: 22, borderLeft: "3px solid #17181C", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontFamily: displayFont, fontSize: 20, margin: 0 }}>Your cart</h2>
              <button onClick={() => { if (!paying) { setCartOpen(false); setCheckoutStep("cart"); } }} style={{ background: "none", border: "none", fontSize: 20 }}>×</button>
            </div>

            {cartCount === 0 && <p style={{ color: "#6b665b" }}>Nothing here yet.</p>}
            {catalog && Object.entries(cart).map(([id, qty]) => {
              const b = catalog.find((x) => x.id === id);
              if (!b) return null;
              return (
                <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #d9d3c4" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: "#6b665b" }}>{formatPrice(b.price)} × {qty}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => removeFromCart(id)} style={{ border: "1px solid #17181C", background: "none", width: 24, height: 24, borderRadius: 3 }}>−</button>
                    <span>{qty}</span>
                    <button onClick={() => addToCart(b)} disabled={qty >= b.stock} style={{ border: "1px solid #17181C", background: "none", width: 24, height: 24, borderRadius: 3, opacity: qty >= b.stock ? 0.4 : 1 }}>+</button>
                  </div>
                </div>
              );
            })}

            {cartCount > 0 && checkoutStep === "cart" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontFamily: displayFont, fontSize: 18 }}>
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <button onClick={goToCheckout} style={{ marginTop: 14, width: "100%", background: "#C1272D", color: "#F3EFE4", border: "none", padding: "12px 0", borderRadius: 3, fontWeight: 700, fontSize: 15 }}>
                  Checkout
                </button>
              </>
            )}

            {cartCount > 0 && checkoutStep === "details" && (
              <form onSubmit={placeOrder} style={{ marginTop: 18, borderTop: "1px solid #d9d3c4", paddingTop: 16 }}>
                <h3 style={{ fontFamily: displayFont, fontSize: 16, margin: "0 0 10px" }}>Delivery details</h3>
                <div style={{ display: "grid", gap: 10 }}>
                  <input placeholder="Full name *" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} style={inputStyle} disabled={paying} />
                  <input placeholder="Phone number *" type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} style={inputStyle} disabled={paying} />
                  <textarea placeholder="Delivery address *" rows={3} value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} disabled={paying} />
                  <input placeholder="Email (optional)" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} style={inputStyle} disabled={paying} />
                </div>
                {customerError && <p style={{ color: "#C1272D", fontSize: 13, marginTop: 10 }}>{customerError}</p>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: displayFont, fontSize: 18 }}>
                  <span>Total</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                <button type="submit" disabled={paying} style={{ marginTop: 12, width: "100%", background: paying ? "#B9B4A6" : "#C1272D", color: "#F3EFE4", border: "none", padding: "12px 0", borderRadius: 3, fontWeight: 700, fontSize: 15 }}>
                  {paying ? "Opening payment…" : "Pay & place order"}
                </button>
                <button type="button" onClick={() => setCheckoutStep("cart")} disabled={paying} style={{ marginTop: 8, width: "100%", background: "none", border: "1px solid #17181C", padding: "10px 0", borderRadius: 3, fontSize: 13 }}>
                  Back to cart
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ---------- ORDER CONFIRMATION STAMP ---------- */}
      {orderStamp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ border: "6px solid #C1272D", color: "#C1272D", borderRadius: "9999px", width: 180, height: 180, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", transform: "rotate(-12deg)", fontFamily: displayFont, background: "rgba(243,239,228,0.85)" }}>
            <span style={{ fontSize: 16 }}>PAYMENT</span>
            <span style={{ fontSize: 20 }}>CONFIRMED</span>
          </div>
        </div>
      )}

      {/* ---------- ADMIN LOGIN ---------- */}
      {view === "admin-login" && (
        <main style={{ maxWidth: 360, margin: "60px auto", padding: "0 20px" }}>
          <h1 style={{ fontFamily: displayFont, fontSize: 24, marginBottom: 4 }}>Shelf keeper login</h1>
          <p style={{ fontSize: 13, color: "#6b665b", marginBottom: 20 }}>Restricted to the person stocking the shelf.</p>
          <form onSubmit={tryLogin}>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Password"
              style={{ width: "100%", padding: "10px 12px", border: "2px solid #17181C", borderRadius: 3, fontSize: 14, marginBottom: 10 }}
              disabled={pwLoading}
            />
            {pwError && <p style={{ color: "#C1272D", fontSize: 13, marginTop: 0 }}>{pwError}</p>}
            <button type="submit" disabled={pwLoading} style={{ width: "100%", background: "#17181C", color: "#F3EFE4", border: "none", padding: "10px 0", borderRadius: 3, fontWeight: 700 }}>
              {pwLoading ? "Checking…" : "Enter"}
            </button>
          </form>
        </main>
      )}

      {/* ---------- ADMIN DASHBOARD ---------- */}
      {view === "admin" && (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "30px 20px 80px" }}>
          <h1 style={{ fontFamily: displayFont, fontSize: 26, marginBottom: 4 }}>Add a new volume</h1>
          <p style={{ fontSize: 13, color: "#6b665b", marginBottom: 20 }}>This goes straight onto the public shelf.</p>

          <form onSubmit={submitBook} style={{ display: "grid", gap: 12, background: "#fff", border: "2px solid #17181C", padding: 20, borderRadius: 4 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
              <input placeholder="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input placeholder="Price (₹) *" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inputStyle} />
              <input placeholder="Stock quantity" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "#6b665b", display: "block", marginBottom: 6 }}>Cover image</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 64, height: 88, border: "2px solid #17181C", background: form.cover ? `url(${form.cover}) center/cover` : "#e7e1d2", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <input type="file" accept="image/*" onChange={handleImageChange} style={{ ...inputStyle, padding: "8px" }} />
                  {imgLoading && <p style={{ fontSize: 12, color: "#6b665b", margin: "4px 0 0" }}>Processing image…</p>}
                  {imgError && <p style={{ fontSize: 12, color: "#C1272D", margin: "4px 0 0" }}>{imgError}</p>}
                  {form.cover && !imgLoading && (
                    <button type="button" onClick={() => setForm((f) => ({ ...f, cover: "" }))} style={{ background: "none", border: "none", color: "#C1272D", fontSize: 12, padding: "4px 0 0", textDecoration: "underline" }}>
                      Remove image
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input placeholder="Badge, e.g. NEW or PREORDER (optional)" value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} style={inputStyle} />
            <textarea placeholder="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
            <button type="submit" disabled={imgLoading} style={{ background: imgLoading ? "#B9B4A6" : "#C1272D", color: "#F3EFE4", border: "none", padding: "12px 0", borderRadius: 3, fontWeight: 700 }}>
              {imgLoading ? "Processing image…" : "Add to shelf"}
            </button>
            {formMsg && <p style={{ fontSize: 13, color: "#1d7a3c", margin: 0 }}>{formMsg}</p>}
            {formError && <p style={{ fontSize: 13, color: "#C1272D", margin: 0 }}>{formError}</p>}
          </form>

          <h2 style={{ fontFamily: displayFont, fontSize: 20, marginTop: 36, marginBottom: 12 }}>Current shelf ({catalog ? catalog.length : 0})</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {catalog && catalog.map((b) => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #d9d3c4", borderRadius: 4, padding: "10px 14px", background: "#fff" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.title} <span style={{ fontWeight: 400, color: "#6b665b" }}>— {b.author}</span></div>
                  <div style={{ fontSize: 12, color: "#6b665b" }}>{formatPrice(b.price)} · {b.stock} in stock {b.tag && `· ${b.tag}`}</div>
                </div>
                <button onClick={() => deleteBook(b.id)} style={{ background: "none", border: "1px solid #C1272D", color: "#C1272D", padding: "6px 12px", borderRadius: 3, fontSize: 12 }}>
                  Remove
                </button>
              </div>
            ))}
          </div>

          <h2 style={{ fontFamily: displayFont, fontSize: 20, marginTop: 36, marginBottom: 12 }}>Recent orders ({orders.length})</h2>
          {ordersLoading && <p style={{ fontSize: 13, color: "#6b665b" }}>Loading orders…</p>}
          {ordersError && <p style={{ fontSize: 13, color: "#C1272D" }}>{ordersError}</p>}
          {!ordersLoading && orders.length === 0 && !ordersError && <p style={{ fontSize: 13, color: "#6b665b" }}>No orders placed yet.</p>}
          <div style={{ display: "grid", gap: 12 }}>
            {orders.map((o) => (
              <div key={o.id} style={{ border: "1px solid #d9d3c4", borderRadius: 4, padding: "14px 16px", background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{o.customer.name}</div>
                  <div style={{ fontSize: 12, color: "#8A8478" }}>{new Date(o.date).toLocaleString("en-IN")}</div>
                </div>
                <div style={{ fontSize: 13, color: "#3a372f", marginTop: 4 }}>{o.customer.phone}{o.customer.email ? ` · ${o.customer.email}` : ""}</div>
                <div style={{ fontSize: 13, color: "#3a372f", marginTop: 2 }}>{o.customer.address}</div>
                <div style={{ fontSize: 11, color: "#8A8478", marginTop: 6 }}>Payment ID: {o.paymentId}</div>
                <div style={{ marginTop: 8, borderTop: "1px dashed #d9d3c4", paddingTop: 8 }}>
                  {o.items.map((it) => (
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>{it.title} × {it.qty}</span>
                      <span>{formatPrice(it.price * it.qty)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 700, fontSize: 14 }}>
                  <span>Total</span>
                  <span>{formatPrice(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}

const inputStyle = {
  padding: "10px 12px",
  border: "1px solid #B9B4A6",
  borderRadius: 3,
  fontSize: 14,
  fontFamily: "inherit",
  width: "100%",
};
