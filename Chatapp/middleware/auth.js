const User = require("../models/User");
const { verifyToken } = require("../utils/token");

// Protects API routes: the browser must send "Authorization: Bearer <token>"
async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ message: "Please log in to continue." });

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ message: "Your session has expired. Please log in again." });
  }

  const user = await User.findById(decoded.id);
  if (!user) return res.status(401).json({ message: "This account no longer exists." });

  req.user = user;
  next();
}

module.exports = { protect };
