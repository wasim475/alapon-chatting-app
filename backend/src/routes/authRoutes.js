import express from "express";
import {
  forgotPassword,
  login,
  logout,
  me,
  register,
  resetPassword
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", protect, me);
router.post("/forgot-password", authLimiter, forgotPassword);
router.patch("/reset-password/:token", authLimiter, resetPassword);

export default router;
 