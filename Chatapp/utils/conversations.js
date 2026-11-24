const Conversation = require("../models/Conversation");

// Finds the conversation between two users, or creates it if it does not exist yet.
// Used by both the REST API and the Socket.IO code.
async function findOrCreateConversation(userA, userB) {
  const key = Conversation.keyFor(userA, userB);
  let conv = await Conversation.findOne({ participantsKey: key });
  if (conv) return conv;

  try {
    conv = await Conversation.create({ participants: [userA, userB], participantsKey: key });
  } catch (err) {
    // Two requests created it at the same moment: the unique index stopped the 2nd one, so load the 1st.
    if (err.code === 11000) return Conversation.findOne({ participantsKey: key });
    throw err;
  }
  return conv;
}

module.exports = { findOrCreateConversation };
