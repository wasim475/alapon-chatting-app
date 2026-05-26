import express from "express";
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  getComments,
  getFeed,
  toggleLike,
  updatePost
} from "../controllers/postController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/feed", getFeed);
router.post("/", upload.array("images", 4), createPost);
router.patch("/:postId", updatePost);
router.delete("/:postId", deletePost);
router.post("/:postId/like", toggleLike);
router.get("/:postId/comments", getComments);
router.post("/:postId/comments", addComment);
router.delete("/comments/:commentId", deleteComment);

export default router;
