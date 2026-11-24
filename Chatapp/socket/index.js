const User = require("../models/User");
const Message = require("../models/Message");
const { verifyToken } = require("../utils/token");
const { publicUser, publicMessage } = require("../utils/serialize");
const { isObjectId, validateMessageText } = require("../utils/validators");
const { findOrCreateConversation } = require("../utils/conversations");

/*
  Socket.IO events (your original names are kept):

  Server -> browser
    active    number of users online right now            (was: sent only to the new user, now sent to everyone)
    chat      a greeting sent only to the user who connected
    join      { user }  someone came online               (was: plain text, now has the user's details)
    leave     { user }  someone went offline              (NEW)
    announce  text announcement                           (was: hard-coded for every connection, now from .env)
    msg       a new private message for you               (was: client -> server log, now the real chat message)
    read      { conversationId, readerId } your messages were read (NEW)

  Browser -> server
    msg       { to, text } with an acknowledgement callback; the server saves it and delivers it
*/

const OFFLINE_GRACE_MS = 3000; // a page refresh should not look like "left and joined again"

function initSocket(io) {
  const sockets = new Map(); // userId -> Set of socket ids (one user can have many tabs)
  const offlineTimers = new Map(); // userId -> timeout waiting to mark the user offline

  // Every socket connection must carry a valid JWT, otherwise it is rejected.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication failed"));
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("Authentication failed"));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", async (socket) => {
    const user = socket.user;
    const uid = String(user._id);

    socket.join(`user:${uid}`); // a private "room" so we can reach all tabs of this user

    const hadTimer = offlineTimers.has(uid);
    if (hadTimer) {
      clearTimeout(offlineTimers.get(uid));
      offlineTimers.delete(uid);
    }
    const alreadyOnline = hadTimer || (sockets.has(uid) && sockets.get(uid).size > 0);
    if (!sockets.has(uid)) sockets.set(uid, new Set());
    sockets.get(uid).add(socket.id);

    console.log(`Connected: ${user.username} | Active users: ${sockets.size}`);

    io.emit("active", sockets.size);
    socket.emit("chat", `Hello ${user.fullName}, you are connected to the server.`);
    if (process.env.ANNOUNCEMENT) socket.emit("announce", process.env.ANNOUNCEMENT);

    // (The "mark me online in the database" step runs after the handlers below are registered,
    //  so a quick disconnect can never be missed.)

    // ---- Sending a message ----
    let recent = []; // timestamps of recent messages, used for simple flood protection
    socket.on("msg", async (payload, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        const now = Date.now();
        recent = recent.filter((t) => now - t < 10000);
        if (recent.length >= 20) return reply({ ok: false, error: "You are sending messages too fast." });
        recent.push(now);

        const to = payload && payload.to;
        const text = validateMessageText(payload && payload.text);
        if (!isObjectId(to) || to === uid) return reply({ ok: false, error: "Invalid recipient." });
        if (!text) return reply({ ok: false, error: "Message must be 1-2000 characters." });

        const receiver = await User.findById(to).select("_id");
        if (!receiver) return reply({ ok: false, error: "Recipient not found." });

        const conv = await findOrCreateConversation(user._id, receiver._id);
        const message = await Message.create({
          conversation: conv._id,
          sender: user._id,
          receiver: receiver._id,
          text,
        });
        conv.lastMessage = message._id;
        conv.lastMessageAt = message.createdAt;
        await conv.save();

        const data = publicMessage(message);
        io.to(`user:${to}`).emit("msg", data); // to the receiver (all their tabs)
        socket.to(`user:${uid}`).emit("msg", data); // to my OTHER tabs (not this one: it gets the ack)
        reply({ ok: true, message: data });
      } catch (err) {
        console.error("msg error:", err);
        reply({ ok: false, error: "Could not send your message. Please try again." });
      }
    });

    // ---- Disconnect ----
    socket.on("disconnect", () => {
      const set = sockets.get(uid);
      if (set) set.delete(socket.id);

      if (set && set.size === 0) {
        const timer = setTimeout(async () => {
          offlineTimers.delete(uid);
          const current = sockets.get(uid);
          if (current && current.size > 0) return;
          sockets.delete(uid);
          const lastSeen = new Date();
          try {
            await User.updateOne({ _id: user._id }, { isOnline: false, lastSeen });
          } catch (err) {
            console.error("Could not set offline status:", err.message);
          }
          user.isOnline = false;
          user.lastSeen = lastSeen;
          io.emit("leave", { user: publicUser(user) });
          io.emit("active", sockets.size);
          console.log(`Disconnected: ${user.username} | Active users: ${sockets.size}`);
        }, OFFLINE_GRACE_MS);
        offlineTimers.set(uid, timer);
      }
    });

    // ---- Mark online in the database and tell everyone else ----
    if (!alreadyOnline) {
      try {
        await User.updateOne({ _id: user._id }, { isOnline: true });
        user.isOnline = true;
      } catch (err) {
        console.error("Could not set online status:", err.message);
      }
      socket.broadcast.emit("join", { user: publicUser(user) });
    }
  });
}

module.exports = initSocket;
