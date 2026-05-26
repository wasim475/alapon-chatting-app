import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

export const protect = catchAsync(async (req, _res, next) => {
  const token = req.cookies.jwt || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new AppError("Please log in to continue", 401));
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select("+passwordChangedAt");

  if (!user || !user.isActive) {
    return next(new AppError("The user for this token no longer exists", 401));
  }

  req.user = user;
  next();
});
