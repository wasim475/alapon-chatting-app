import express from "express";
import {
  blockUser,
  cancelRequest,
  listFriends,
  listRequests,
  listSentRequests,
  removeFriend,
  respondRequest,
  sendRequest,
  unblockUser,
} from "../controllers/friendController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/requests", listRequests);
router.get("/requests/sent", listSentRequests);
router.get("/list", listFriends);
router.post("/request/:userId", sendRequest);
router.delete("/request/:userId", cancelRequest);
router.patch("/request/:requestId", respondRequest);
router.post("/block/:userId", blockUser);
router.delete("/block/:userId", unblockUser);
router.delete("/:userId", removeFriend);

export default router;
