import FriendRequest from "../models/FriendRequest.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

export const sendRequest = catchAsync(async (req, res, next) => {
  const receiverId = req.params.userId;

  if (receiverId === String(req.user._id)) {
    return next(new AppError("You cannot send a request to yourself", 400));
  }

  const receiver = await User.findById(receiverId);
  if (!receiver) return next(new AppError("User not found", 404));

  if (req.user.friends.some((id) => String(id) === receiverId)) {
    return next(new AppError("You are already friends", 400));
  }

  const request = await FriendRequest.create({
    sender: req.user._id,
    receiver: receiverId
  });

  await Notification.create({
    recipient: receiverId,
    sender: req.user._id,
    type: "friend_request",
    entityType: "FriendRequest",
    entity: request._id,
    text: `${req.user.name} sent you a friend request`
  });

  req.app.get("io").to(receiverId).emit("notification:new");
  res.status(201).json({ status: "success", request });
});

export const respondRequest = catchAsync(async (req, res, next) => {
  const { action } = req.body;
  const request = await FriendRequest.findById(req.params.requestId);

  if (!request || String(request.receiver) !== String(req.user._id)) {
    return next(new AppError("Friend request not found", 404));
  }

  if (!["accepted", "rejected"].includes(action)) {
    return next(new AppError("Action must be accepted or rejected", 400));
  }

  request.status = action;
  await request.save();

  if (action === "accepted") {
    await User.bulkWrite([
      { updateOne: { filter: { _id: request.sender }, update: { $addToSet: { friends: request.receiver } } } },
      { updateOne: { filter: { _id: request.receiver }, update: { $addToSet: { friends: request.sender } } } }
    ]);

    await Notification.create({
      recipient: request.sender,
      sender: req.user._id,
      type: "friend_accept",
      entityType: "FriendRequest",
      entity: request._id,
      text: `${req.user.name} accepted your friend request`
    });
  }

  res.json({ status: "success", request });
});

export const removeFriend = catchAsync(async (req, res) => {
  await User.bulkWrite([
    { updateOne: { filter: { _id: req.user._id }, update: { $pull: { friends: req.params.userId } } } },
    { updateOne: { filter: { _id: req.params.userId }, update: { $pull: { friends: req.user._id } } } }
  ]);

  res.json({ status: "success" });
});

export const listRequests = catchAsync(async (req, res) => {
  const requests = await FriendRequest.find({
    receiver: req.user._id,
    status: "pending"
  }).populate("sender", "name profile.avatar");

  res.json({ status: "success", requests });
});
