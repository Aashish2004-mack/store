import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export function checkPassword(pw) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return false; // not configured yet
  return bcrypt.compareSync(String(pw || ""), hash);
}

export function issueToken() {
  return jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Session expired — please log in again." });
  }
}
