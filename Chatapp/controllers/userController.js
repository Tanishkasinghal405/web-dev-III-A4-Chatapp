const User = require("../models/User");
const { publicUser } = require("../utils/serialize");
const { escapeRegex, validateProfile } = require("../utils/validators");

// GET /api/users?search=ali  -> find other users by username or name
async function searchUsers(req, res) {
  const q = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 30) : "";
  const filter = { _id: { $ne: req.user._id } };

  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ username: rx }, { fullName: rx }];
  }

  const users = await User.find(filter).sort({ username: 1 }).limit(20);
  res.json({ users: users.map((u) => publicUser(u)) });
}

// GET /api/users/online -> everyone currently online (except me)
async function onlineUsers(req, res) {
  const users = await User.find({ isOnline: true, _id: { $ne: req.user._id } })
    .sort({ fullName: 1 })
    .limit(100);
  res.json({ users: users.map((u) => publicUser(u)) });
}

// PATCH /api/users/me -> update my name / profile picture
async function updateMe(req, res) {
  const { errors, values } = validateProfile(req.body || {});
  if (Object.keys(errors).length) {
    return res.status(400).json({ message: "Please fix the highlighted fields.", errors });
  }
  if (!Object.keys(values).length) {
    return res.status(400).json({ message: "Nothing to update." });
  }

  Object.assign(req.user, values);
  await req.user.save();
  res.json({ message: "Profile updated.", user: publicUser(req.user, { includeEmail: true }) });
}

module.exports = { searchUsers, onlineUsers, updateMe };
