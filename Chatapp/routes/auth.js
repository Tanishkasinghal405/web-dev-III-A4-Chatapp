const express = require("express");
const { register, login, me } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many attempts. Please wait a few minutes and try again.",
});

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", protect, me);

module.exports = router;
