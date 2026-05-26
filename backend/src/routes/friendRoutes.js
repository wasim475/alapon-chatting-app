import express from "express";
import {
  listFriends,
  listRequests,
  listSentRequests,
  removeFriend,
  respondRequest,
  sendRequest,
} from "../controllers/friendController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/requests", listRequests);
router.get("/requests/sent", listSentRequests);
router.get("/list", listFriends);
router.post("/request/:userId", sendRequest);
router.patch("/request/:requestId", respondRequest);
router.delete("/:userId", removeFriend);

export default router;
