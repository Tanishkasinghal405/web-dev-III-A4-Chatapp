const express = require("express");
const { searchUsers, onlineUsers, updateMe } = require("../controllers/userController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect); // every route below needs a valid login token

router.get("/", searchUsers);
router.get("/online", onlineUsers);
router.patch("/me", updateMe);

module.exports = router;
