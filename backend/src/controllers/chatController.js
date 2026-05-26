import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { getSocketId } from "../socket/index.js";

export const getOrCreateConversation = catchAsync(async (req, res, next) => {
  const friendId = req.params.userId;
  const user = await User.findById(req.user._id);

  if (!user.friends.some((id) => String(id) === friendId)) {
    return next(new AppError("You can only chat with friends", 403));
  }

  let conversation = await Conversation.findOne({
    participants: { $all: [req.user._id, friendId], $size: 2 },
  }).populate("participants", "name profile.avatar lastSeenAt");

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [req.user._id, friendId],
    });
    await conversation.populate(
      "participants",
      "name profile.avatar lastSeenAt",
    );
  }

  res.json({ status: "success", conversation });
});

export const listConversations = catchAsync(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id })
    .populate("participants", "name profile.avatar lastSeenAt")
    .populate("lastMessage")
    .sort({ lastMessageAt: -1 });

  const unreadResults = await Message.aggregate([
    {
      $match: {
        conversation: { $in: conversations.map((conv) => conv._id) },
        sender: { $ne: req.user._id },
        "seenBy.user": { $ne: req.user._id },
      },
    },
    {
      $group: {
        _id: "$conversation",
        count: { $sum: 1 },
      },
    },
  ]);

  const unreadMap = new Map(
    unreadResults.map((entry) => [String(entry._id), entry.count]),
  );

  const conversationsWithUnread = conversations.map((conversation) => ({
    ...conversation.toObject(),
    unreadCount: unreadMap.get(String(conversation._id)) || 0,
  }));

  res.json({ status: "success", conversations: conversationsWithUnread });
});

export const listMessages = catchAsync(async (req, res) => {
  const messages = await Message.find({
    conversation: req.params.conversationId,
  })
    .populate("sender", "name profile.avatar")
    .sort({ createdAt: 1 })
    .limit(80);

  res.json({ status: "success", messages });
});

export const markConversationRead = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  });

  if (!conversation) return next(new AppError("Conversation not found", 404));

  await Message.updateMany(
    {
      conversation: conversation._id,
      sender: { $ne: req.user._id },
      "seenBy.user": { $ne: req.user._id },
    },
    {
      $push: {
        seenBy: { user: req.user._id, seenAt: new Date() },
      },
    },
  );

  req.app
    .get("io")
    .to(String(conversation._id))
    .emit("message:read", {
      conversationId: String(conversation._id),
      userId: String(req.user._id),
    });

  res.json({ status: "success" });
});

export const sendMessage = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  });

  if (!conversation) return next(new AppError("Conversation not found", 404));

  const image = req.file
    ? await uploadBufferToCloudinary(req.file.buffer, "alapon/messages")
    : "";

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text: req.body.text,
    image,
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  await message.populate("sender", "name profile.avatar");

  const io = req.app.get("io");
  const senderSocketId = getSocketId(req.user._id);

  if (senderSocketId && typeof io.to === "function") {
    io.to(String(conversation._id)).except(senderSocketId).emit("message:new", message);
  } else {
    io.to(String(conversation._id)).emit("message:new", message);
  }

  res.status(201).json({ status: "success", message });
});
