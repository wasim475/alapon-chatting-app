import crypto from "crypto";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { sendAuthCookie, signToken } from "../utils/jwt.js";

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  sendAuthCookie(res, token);

  res.status(statusCode).json({
    status: "success",
    token,
    user: user.toSafeObject ? user.toSafeObject() : user
  });
};

export const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;
  const user = await User.create({ name, email, password });
  createSendToken(user, 201, res);
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new AppError("Email and password are required", 400));
  }

  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError("Invalid email or password", 401));
  }

  createSendToken(user, 200, res);
});

export const logout = (_req, res) => {
  res.cookie("jwt", "logged-out", {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true
  });
  res.json({ status: "success" });
};

export const me = catchAsync(async (req, res) => {
  res.json({ status: "success", user: req.user });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email }).select(
    "+passwordResetToken +passwordResetExpires"
  );

  if (!user) return next(new AppError("No user found with that email", 404));

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  res.json({
    status: "success",
    message: "Password reset token generated. Wire this to your email provider.",
    resetToken
  });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  }).select("+passwordResetToken +passwordResetExpires");

  if (!user) return next(new AppError("Reset token is invalid or expired", 400));

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.passwordChangedAt = Date.now();
  await user.save();

  createSendToken(user, 200, res);
});
