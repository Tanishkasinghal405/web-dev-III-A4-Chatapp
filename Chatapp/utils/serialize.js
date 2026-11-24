// Turns database documents into safe objects to send to the browser.
// (Never includes the password hash.)

function publicUser(u, { includeEmail = false } = {}) {
  const out = {
    id: String(u._id),
    fullName: u.fullName,
    username: u.username,
    profilePicture: u.profilePicture || "",
    isOnline: !!u.isOnline,
    lastSeen: u.lastSeen,
  };
  if (includeEmail) out.email = u.email;
  return out;
}

function publicMessage(m) {
  return {
    id: String(m._id),
    conversation: String(m.conversation),
    sender: String(m.sender),
    receiver: String(m.receiver),
    text: m.text,
    read: !!m.read,
    createdAt: m.createdAt,
  };
}

module.exports = { publicUser, publicMessage };
