import express from "express";
import {
  getOrCreateConversation,
  listConversations,
  listMessages,
  sendMessage
} from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/conversations", listConversations);
router.post("/conversations/:userId", getOrCreateConversation);
router.get("/conversations/:conversationId/messages", listMessages);
router.post(
  "/conversations/:conversationId/messages",
  upload.single("image"),
  sendMessage
);

export default router;
