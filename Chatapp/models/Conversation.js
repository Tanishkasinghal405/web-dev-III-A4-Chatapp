const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    // Exactly two people take part in a conversation
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      validate: [(arr) => arr.length === 2, "A conversation needs exactly 2 participants"],
    },
    // "idA_idB" (sorted). The unique index guarantees only ONE conversation per pair of users.
    participantsKey: { type: String, required: true, unique: true },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    lastMessageAt: { type: Date, default: null },
    // "Delete conversation" hides the chat history for ONE user only (the other person keeps it)
    hiddenFor: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: Date,
      },
    ],
  },
  { timestamps: true } // adds createdAt and updatedAt
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.statics.keyFor = function (a, b) {
  return [String(a), String(b)].sort().join("_");
};

module.exports = mongoose.model("Conversation", conversationSchema);
