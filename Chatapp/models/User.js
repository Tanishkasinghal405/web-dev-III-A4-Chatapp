const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    username: {
      type: String,
      required: true,
      unique: true, // unique index: no two users can share a username
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-z0-9_]+$/,
    },
    email: {
      type: String,
      required: true,
      unique: true, // unique index: no two users can share an email
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    // select:false means the hashed password is never returned unless we ask for it
    password: { type: String, required: true, select: false },
    profilePicture: { type: String, default: "", maxlength: 500 },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

userSchema.index({ isOnline: 1 });
userSchema.index({ fullName: 1 });

// Hash the password automatically before saving (only when it changed)
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
