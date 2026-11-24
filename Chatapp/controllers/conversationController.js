const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const { publicUser, publicMessage } = require("../utils/serialize");
const { isObjectId } = require("../utils/validators");
const { findOrCreateConversation } = require("../utils/conversations");

// When did THIS user last "deleted" the conversation? (null = never)
function hiddenAtFor(conv, userId) {
  const entry = (conv.hiddenFor || []).find((h) => String(h.user) === String(userId));
  return entry ? entry.at : null;
}

function isParticipant(conv, userId) {
  return conv.participants.some((p) => String(p._id || p) === String(userId));
}

async function unreadCount(conv, userId) {
  const hiddenAt = hiddenAtFor(conv, userId);
  const filter = { conversation: conv._id, receiver: userId, read: false };
  if (hiddenAt) filter.createdAt = { $gt: hiddenAt };
  return Message.countDocuments(filter);
}

// Loads a conversation and makes sure the logged-in user belongs to it (authorization check)
async function loadAuthorized(req, res) {
  if (!isObjectId(req.params.id)) {
    res.status(400).json({ message: "Invalid conversation id." });
    return null;
  }
  const conv = await Conversation.findById(req.params.id);
  if (!conv || !isParticipant(conv, req.user._id)) {
    // Same answer in both cases, so nobody can discover other people's conversation ids
    res.status(404).json({ message: "Conversation not found." });
    return null;
  }
  return conv;
}

// GET /api/conversations -> my recent conversations (with last message + unread count)
async function listConversations(req, res) {
  const me = req.user._id;
  const convs = await Conversation.find({ participants: me, lastMessage: { $ne: null } })
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .populate("lastMessage")
    .populate("participants");

  const visible = convs.filter((c) => {
    const hiddenAt = hiddenAtFor(c, me);
    return !hiddenAt || (c.lastMessageAt && c.lastMessageAt > hiddenAt);
  });

  const items = await Promise.all(
    visible.map(async (c) => {
      const other = c.participants.find((p) => String(p._id) !== String(me));
      return {
        id: String(c._id),
        user: publicUser(other),
        lastMessage: c.lastMessage ? publicMessage(c.lastMessage) : null,
        unread: await unreadCount(c, me),
        updatedAt: c.lastMessageAt,
      };
    })
  );

  res.json({ conversations: items });
}

// POST /api/conversations   body: { userId } -> open (or create) a chat with that user
async function startConversation(req, res) {
  const { userId } = req.body || {};
  if (!isObjectId(userId)) return res.status(400).json({ message: "Invalid user." });
  if (String(userId) === String(req.user._id)) {
    return res.status(400).json({ message: "You cannot start a conversation with yourself." });
  }

  const other = await User.findById(userId);
  if (!other) return res.status(404).json({ message: "User not found." });

  const conv = await findOrCreateConversation(req.user._id, other._id);
  res.status(201).json({
    conversation: {
      id: String(conv._id),
      user: publicUser(other),
      lastMessage: null,
      unread: await unreadCount(conv, req.user._id),
      updatedAt: conv.lastMessageAt,
    },
  });
}

// GET /api/conversations/:id/messages?before=<ISO date>&limit=40
async function getMessages(req, res) {
  const conv = await loadAuthorized(req, res);
  if (!conv) return;

  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 40, 1), 100);
  const createdAt = {};
  const hiddenAt = hiddenAtFor(conv, req.user._id);
  if (hiddenAt) createdAt.$gt = hiddenAt;
  if (req.query.before) {
    const before = new Date(req.query.before);
    if (isNaN(before.getTime())) return res.status(400).json({ message: "Invalid date." });
    createdAt.$lt = before;
  }

  const filter = { conversation: conv._id };
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  const rows = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map(publicMessage);
  res.json({ messages, hasMore });
}

// POST /api/conversations/:id/read -> mark messages sent to me as read
async function markRead(req, res) {
  const conv = await loadAuthorized(req, res);
  if (!conv) return;

  const result = await Message.updateMany(
    { conversation: conv._id, receiver: req.user._id, read: false },
    { $set: { read: true, readAt: new Date() } }
  );

  if (result.modifiedCount > 0) {
    const other = conv.participants.find((p) => String(p) !== String(req.user._id));
    const io = req.app.get("io");
    // Tell the sender in real time so their ticks turn blue
    if (io && other) {
      io.to(`user:${other}`).emit("read", {
        conversationId: String(conv._id),
        readerId: String(req.user._id),
      });
    }
  }
  res.json({ updated: result.modifiedCount });
}

// DELETE /api/conversations/:id -> remove the chat from MY view only
async function deleteConversation(req, res) {
  const conv = await loadAuthorized(req, res);
  if (!conv) return;

  const me = new mongoose.Types.ObjectId(String(req.user._id));
  await Conversation.updateOne({ _id: conv._id }, { $pull: { hiddenFor: { user: me } } });
  await Conversation.updateOne({ _id: conv._id }, { $push: { hiddenFor: { user: me, at: new Date() } } });

  res.json({ message: "Conversation deleted." });
}

module.exports = {
  listConversations,
  startConversation,
  getMessages,
  markRead,
  deleteConversation,
};
