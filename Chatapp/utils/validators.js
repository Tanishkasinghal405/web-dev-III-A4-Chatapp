const mongoose = require("mongoose");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

const isObjectId = (v) => typeof v === "string" && mongoose.isValidObjectId(v) && /^[a-f0-9]{24}$/i.test(v);
const isString = (v) => typeof v === "string";

// Escapes characters that have a special meaning in regular expressions
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function validateRegistration(body) {
  const errors = {};
  const fullName = isString(body.fullName) ? body.fullName.trim() : "";
  const username = isString(body.username) ? body.username.trim().toLowerCase() : "";
  const email = isString(body.email) ? body.email.trim().toLowerCase() : "";
  const password = isString(body.password) ? body.password : "";
  const confirmPassword = isString(body.confirmPassword) ? body.confirmPassword : "";

  if (fullName.length < 2 || fullName.length > 60) errors.fullName = "Full name must be 2-60 characters.";
  if (!USERNAME_RE.test(username))
    errors.username = "Username must be 3-20 characters: lowercase letters, numbers or underscore.";
  if (!EMAIL_RE.test(email) || email.length > 120) errors.email = "Enter a valid email address.";
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.password = "Password must be 8-72 characters and contain at least one letter and one number.";
  if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

  return { errors, values: { fullName, username, email, password } };
}

function validateProfile(body) {
  const errors = {};
  const values = {};
  if (body.fullName !== undefined) {
    const fullName = isString(body.fullName) ? body.fullName.trim() : "";
    if (fullName.length < 2 || fullName.length > 60) errors.fullName = "Full name must be 2-60 characters.";
    else values.fullName = fullName;
  }
  if (body.profilePicture !== undefined) {
    const pic = isString(body.profilePicture) ? body.profilePicture.trim() : "";
    if (pic && (!/^https?:\/\/\S+$/i.test(pic) || pic.length > 500))
      errors.profilePicture = "Profile picture must be a valid http(s) image link.";
    else values.profilePicture = pic;
  }
  return { errors, values };
}

function validateMessageText(text) {
  if (!isString(text)) return null;
  const t = text.trim();
  if (t.length < 1 || t.length > 2000) return null;
  return t;
}

module.exports = {
  isObjectId,
  escapeRegex,
  validateRegistration,
  validateProfile,
  validateMessageText,
};
