const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // createdAt is the message timestamp
);

// Fast loading of a conversation's history (newest first)
messageSchema.index({ conversation: 1, createdAt: -1 });
// Fast unread counting
messageSchema.index({ conversation: 1, receiver: 1, read: 1 });

module.exports = mongoose.model("Message", messageSchema);
