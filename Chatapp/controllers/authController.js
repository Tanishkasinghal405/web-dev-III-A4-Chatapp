const User = require("../models/User");
const { signToken } = require("../utils/token");
const { publicUser } = require("../utils/serialize");
const { validateRegistration } = require("../utils/validators");

// POST /api/auth/register
async function register(req, res) {
  const { errors, values } = validateRegistration(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Please fix the highlighted fields.", errors });
  }

  const existing = await User.findOne({
    $or: [{ email: values.email }, { username: values.username }],
  }).select("email username");

  if (existing) {
    const dup = {};
    if (existing.email === values.email) dup.email = "This email is already registered.";
    if (existing.username === values.username) dup.username = "This username is already taken.";
    return res.status(409).json({ message: "Account already exists.", errors: dup });
  }

  let user;
  try {
    user = await User.create(values); // password is hashed by the model before saving
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "That username or email is already in use." });
    }
    throw err;
  }

  res.status(201).json({
    message: "Account created successfully!",
    token: signToken(user._id, false),
    user: publicUser(user, { includeEmail: true }),
  });
}

// POST /api/auth/login   body: { identifier, password, remember }
async function login(req, res) {
  const { identifier, password, remember } = req.body || {};

  if (typeof identifier !== "string" || typeof password !== "string" || !identifier.trim() || !password) {
    return res.status(400).json({ message: "Enter your email or username and your password." });
  }

  const id = identifier.trim().toLowerCase();
  const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select("+password");

  // Same message for "no such user" and "wrong password" so attackers learn nothing
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Incorrect email/username or password." });
  }

  res.json({
    message: "Welcome back!",
    token: signToken(user._id, remember === true),
    user: publicUser(user, { includeEmail: true }),
  });
}

// GET /api/auth/me  (protected)
async function me(req, res) {
  res.json({ user: publicUser(req.user, { includeEmail: true }) });
}

module.exports = { register, login, me };
