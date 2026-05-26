import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import FriendRequest from "../models/FriendRequest.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { getOnlineUsers } from "../socket/index.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";

export const sendRequest = catchAsync(async (req, res, next) => {
  const receiverId = req.params.userId;

  if (!mongoose.isValidObjectId(receiverId)) {
    return next(new AppError("Invalid user id", 400));
  }

  if (receiverId === String(req.user._id)) {
    return next(new AppError("You cannot send a request to yourself", 400));
  }

  const receiver = await User.findById(receiverId).select("_id blockedUsers");
  if (!receiver) return next(new AppError("User not found", 404));

  if (
    Array.isArray(req.user.friends) &&
    req.user.friends.some((id) => String(id) === receiverId)
  ) {
    return next(new AppError("You are already friends", 400));
  }

  if (
    Array.isArray(req.user.blockedUsers) &&
    req.user.blockedUsers.some((id) => String(id) === receiverId)
  ) {
    return next(new AppError("You have blocked this user", 403));
  }

  if (
    Array.isArray(receiver.blockedUsers) &&
    receiver.blockedUsers.some((id) => String(id) === String(req.user._id))
  ) {
    return next(new AppError("You cannot send a request to this user", 403));
  }

  const existingRequest = await FriendRequest.findOne({
    $or: [
      { sender: req.user._id, receiver: receiverId, status: "pending" },
      { sender: receiverId, receiver: req.user._id, status: "pending" },
    ],
  });

  if (existingRequest) {
    if (String(existingRequest.sender) === String(req.user._id)) {
      return next(new AppError("Friend request already sent", 400));
    }
    return next(new AppError("This user already sent you a request", 400));
  }

  const request = await FriendRequest.create({
    sender: req.user._id,
    receiver: receiverId,
  });

  await Notification.create({
    recipient: receiverId,
    sender: req.user._id,
    type: "friend_request",
    entityType: "FriendRequest",
    entity: request._id,
    text: `${req.user.name} sent you a friend request`,
  });

  req.app
    .get("io")
    .to(receiverId)
    .emit("notification:new", {
      type: "friend_request",
      sender: req.user._id,
      senderName: req.user.name,
      requestId: String(request._id),
    });
  req.app
    .get("io")
    .to(receiverId)
    .emit("friend_request:new", {
      requestId: String(request._id),
    });
  res.status(201).json({ status: "success", request });
});

export const respondRequest = catchAsync(async (req, res, next) => {
  const { action } = req.body;
  const request = await FriendRequest.findById(req.params.requestId);

  if (!request || String(request.receiver) !== String(req.user._id)) {
    return next(new AppError("Friend request not found", 404));
  }

  if (request.status !== "pending") {
    return next(new AppError("Friend request is no longer pending", 400));
  }

  if (!["accepted", "rejected"].includes(action)) {
    return next(new AppError("Action must be accepted or rejected", 400));
  }

  request.status = action;
  await request.save();

  if (action === "accepted") {
    await User.bulkWrite([
      {
        updateOne: {
          filter: { _id: request.sender },
          update: { $addToSet: { friends: request.receiver } },
        },
      },
      {
        updateOne: {
          filter: { _id: request.receiver },
          update: { $addToSet: { friends: request.sender } },
        },
      },
    ]);

    await Notification.create({
      recipient: request.sender,
      sender: req.user._id,
      type: "friend_accept",
      entityType: "FriendRequest",
      entity: request._id,
      text: `${req.user.name} accepted your friend request`,
    });

    req.app
      .get("io")
      .to(String(request.sender))
      .emit("notification:new", {
        type: "friend_accept",
        message: `${req.user.name} accepted your friend request`,
      });
    req.app
      .get("io")
      .to(String(request.sender))
      .emit("friend_request:accepted", {
        friendId: String(request.receiver),
      });
  } else {
    req.app
      .get("io")
      .to(String(request.sender))
      .emit("friend_request:rejected", {
        requestId: String(request._id),
      });
  }

  res.json({ status: "success", request });
});

export const listSentRequests = catchAsync(async (req, res) => {
  const requests = await FriendRequest.find({
    sender: req.user._id,
    status: "pending",
  }).populate("receiver", "name profile.avatar");

  res.json({ status: "success", requests });
});

export const listFriends = catchAsync(async (req, res) => {
  const userFriends = Array.isArray(req.user.friends) ? req.user.friends : [];
  const onlineUsers = getOnlineUsers();

  if (!userFriends.length) {
    return res.json({ status: "success", friends: [] });
  }

  const friends = await User.find({ _id: { $in: userFriends } })
    .select("name profile.avatar lastSeenAt")
    .lean();

  const conversations = await Conversation.find({
    participants: req.user._id,
  })
    .select("participants")
    .lean();

  const conversationMap = new Map();
  conversations.forEach((conv) => {
    const other = conv.participants.find(
      (id) => String(id) !== String(req.user._id),
    );
    if (other) conversationMap.set(String(other), conv._id);
  });

  const friendData = await Promise.all(
    friends.map(async (friend) => {
      const friendId = String(friend._id);
      let unreadCount = 0;

      if (conversationMap.has(friendId)) {
        const conversationId = conversationMap.get(friendId);
        unreadCount = await Message.countDocuments({
          conversation: conversationId,
          sender: friendId,
          "seenBy.user": { $ne: req.user._id },
        });
      }

      return {
        ...friend,
        online: onlineUsers.has(friendId),
        lastSeenAt: friend.lastSeenAt,
        conversationId: conversationMap.get(friendId) || null,
        unreadCount,
      };
    }),
  );

  res.json({ status: "success", friends: friendData });
});

export const removeFriend = catchAsync(async (req, res) => {
  await User.bulkWrite([
    {
      updateOne: {
        filter: { _id: req.user._id },
        update: { $pull: { friends: req.params.userId } },
      },
    },
    {
      updateOne: {
        filter: { _id: req.params.userId },
        update: { $pull: { friends: req.user._id } },
      },
    },
  ]);

  res.json({ status: "success" });
});

export const blockUser = catchAsync(async (req, res, next) => {
  const userId = req.params.userId;

  if (!mongoose.isValidObjectId(userId)) {
    return next(new AppError("Invalid user id", 400));
  }

  if (userId === String(req.user._id)) {
    return next(new AppError("You cannot block yourself", 400));
  }

  await User.bulkWrite([
    {
      updateOne: {
        filter: { _id: req.user._id },
        update: {
          $addToSet: { blockedUsers: userId },
          $pull: { friends: userId },
        },
      },
    },
    {
      updateOne: {
        filter: { _id: userId },
        update: { $pull: { friends: req.user._id } },
      },
    },
  ]);

  await FriendRequest.deleteMany({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id },
    ],
  });

  res.json({ status: "success" });
});

export const unblockUser = catchAsync(async (req, res, next) => {
  const userId = req.params.userId;

  if (!mongoose.isValidObjectId(userId)) {
    return next(new AppError("Invalid user id", 400));
  }

  await User.updateOne(
    { _id: req.user._id },
    { $pull: { blockedUsers: userId } },
  );

  res.json({ status: "success" });
});

export const listRequests = catchAsync(async (req, res) => {
  const requests = await FriendRequest.find({
    receiver: req.user._id,
    status: "pending",
  }).populate("sender", "name profile.avatar");

  res.json({ status: "success", requests });
});
