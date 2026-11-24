const express = require("express");
const c = require("../controllers/conversationController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect); // every route below needs a valid login token

router.get("/", c.listConversations);
router.post("/", c.startConversation);
router.get("/:id/messages", c.getMessages);
router.post("/:id/read", c.markRead);
router.delete("/:id", c.deleteConversation);

module.exports = router;
