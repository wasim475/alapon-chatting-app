import Notification from "../models/Notification.js";
import { catchAsync } from "../utils/catchAsync.js";

export const listNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate("sender", "name profile.avatar")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ status: "success", notifications });
});

export const markRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, readAt: null },
    { readAt: new Date() }
  );

  res.json({ status: "success" });
});
