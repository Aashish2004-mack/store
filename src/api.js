const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // no body
  }
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

export const api = {
  getCatalog: () => request("/catalog"),
  addBook: (book, token) =>
    request("/catalog", { method: "POST", body: JSON.stringify(book), headers: authHeader(token) }),
  deleteBook: (id, token) =>
    request(`/catalog/${id}`, { method: "DELETE", headers: authHeader(token) }),
  getOrders: (token) => request("/orders", { headers: authHeader(token) }),
  login: (password) => request("/login", { method: "POST", body: JSON.stringify({ password }) }),
  createPaymentOrder: (items) =>
    request("/payments/create-order", { method: "POST", body: JSON.stringify({ items }) }),
  verifyPayment: (payload) =>
    request("/payments/verify", { method: "POST", body: JSON.stringify(payload) }),
};
