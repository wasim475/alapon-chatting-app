import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

export const searchUsers = catchAsync(async (req, res) => {
  const q = req.query.q?.trim();
  const filter = q
    ? {
        _id: { $ne: req.user._id },
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } }
        ]
      }
    : { _id: { $ne: req.user._id } };

  const users = await User.find(filter)
    .select("name email profile friends lastSeenAt")
    .limit(20);

  res.json({ status: "success", users });
});

export const getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .select("-password")
    .populate("friends", "name profile.avatar");

  if (!user) return next(new AppError("User not found", 404));

  res.json({ status: "success", user });
});

export const updateProfile = catchAsync(async (req, res) => {
  const allowed = ["bio", "work", "education", "location", "website"];
  const profile = {};

  allowed.forEach((field) => {
    if (req.body[field] !== undefined) profile[`profile.${field}`] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, profile, {
    new: true,
    runValidators: true
  });

  res.json({ status: "success", user });
});

export const uploadProfileImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError("Please upload an image", 400));
  const field = req.params.type === "cover" ? "coverPhoto" : "avatar";
  const url = await uploadBufferToCloudinary(req.file.buffer, `alapon/${field}`);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { [`profile.${field}`]: url },
    { new: true }
  );

  res.json({ status: "success", user });
});
