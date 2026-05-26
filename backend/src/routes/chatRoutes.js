import express from "express";
import {
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/conversations", listConversations);
router.post("/conversations/:userId", getOrCreateConversation);
router.get("/conversations/:conversationId/messages", listMessages);
router.patch("/conversations/:conversationId/read", markConversationRead);
router.post(
  "/conversations/:conversationId/messages",
  upload.single("media"),
  sendMessage,
);

export default router;
