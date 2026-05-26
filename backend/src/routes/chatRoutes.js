import express from "express";
import {
  editMessage,
  getOrCreateConversation,
  listConversations,
  listMessages,
  markConversationRead,
  sendMessage,
  unsendMessage,
  deleteMessage,
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
router.patch(
  "/conversations/:conversationId/messages/:messageId",
  editMessage,
);
router.delete(
  "/conversations/:conversationId/messages/:messageId",
  deleteMessage,
);
router.post(
  "/conversations/:conversationId/messages/:messageId/unsend",
  unsendMessage,
);

export default router;
