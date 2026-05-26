import express from "express";
import {
  getProfile,
  searchUsers,
  updateProfile,
  uploadProfileImage
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/search", searchUsers);
router.get("/:id", getProfile);
router.patch("/me/profile", updateProfile);
router.post("/me/upload/:type", upload.single("image"), uploadProfileImage);

export default router;
