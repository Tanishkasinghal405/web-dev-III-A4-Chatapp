const jwt = require("jsonwebtoken");

// "Remember me" keeps you logged in for 30 days, otherwise 1 day.
function signToken(userId, remember = false) {
  return jwt.sign({ id: String(userId) }, process.env.JWT_SECRET, {
    expiresIn: remember ? "30d" : "1d",
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
