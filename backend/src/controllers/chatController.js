import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";
import { getSocketId } from "../socket/index.js";

const normalizeParticipantIds = (ids) =>
  ids.map((id) => String(id)).sort();

const mergeDuplicateConversations = async (conversations) => {
  const sorted = conversations.sort((a, b) =>
    new Date(b.lastMessageAt || b.createdAt) -
    new Date(a.lastMessageAt || a.createdAt),
  );

  const primary = sorted[0];
  const duplicates = sorted.slice(1);
  const duplicateIds = duplicates.map((conversation) => conversation._id);

  await Message.updateMany(
    { conversation: { $in: duplicateIds } },
    { conversation: primary._id },
  );

  await Conversation.deleteMany({ _id: { $in: duplicateIds } });

  const lastMessage = await Message.findOne({
    conversation: primary._id,
  })
    .sort({ createdAt: -1 })
    .select("_id createdAt");

  if (lastMessage) {
    primary.lastMessage = lastMessage._id;
    primary.lastMessageAt = lastMessage.createdAt;
    await primary.save();
  }

  return primary;
};

const findConversationForUsers = async (userId, friendId) => {
  const conversations = await Conversation.find({
    participants: { $all: [userId, friendId], $size: 2 },
  }).sort({ lastMessageAt: -1, createdAt: -1 });

  if (!conversations.length) return null;
  if (conversations.length === 1) return conversations[0];
  return mergeDuplicateConversations(conversations);
};

const mergeDuplicateConversationGroups = async (userId, conversations) => {
  const grouped = new Map();

  conversations.forEach((conversation) => {
    const otherParticipant = conversation.participants.find(
      (participant) => String(participant._id || participant) !== String(userId),
    );
    const otherId = String(otherParticipant?._id || otherParticipant);
    if (!otherId) return;

    if (!grouped.has(otherId)) grouped.set(otherId, []);
    grouped.get(otherId).push(conversation);
  });

  const mergeTasks = [];
  grouped.forEach((group) => {
    if (group.length > 1) {
      mergeTasks.push(mergeDuplicateConversations(group));
    }
  });

  if (mergeTasks.length) {
    await Promise.all(mergeTasks);
  }
};

export const getOrCreateConversation = catchAsync(async (req, res, next) => {
  const friendId = req.params.userId;
  const user = await User.findById(req.user._id);

  if (!user.friends.some((id) => String(id) === friendId)) {
    return next(new AppError("You can only chat with friends", 403));
  }

  let conversation = await findConversationForUsers(req.user._id, friendId);

  if (!conversation) {
    try {
      conversation = await Conversation.create({
        participants: [req.user._id, friendId],
      });
    } catch (error) {
      if (error.code === 11000) {
        conversation = await findConversationForUsers(req.user._id, friendId);
      } else {
        throw error;
      }
    }
  }

  await conversation.populate(
    "participants",
    "name profile.avatar lastSeenAt",
  );

  res.json({ status: "success", conversation });
});

export const listConversations = catchAsync(async (req, res) => {
  let conversations = await Conversation.find({ participants: req.user._id })
    .populate("participants", "name profile.avatar lastSeenAt")
    .populate("lastMessage")
    .sort({ lastMessageAt: -1 });

  const duplicateGroups = new Map();

  conversations.forEach((conversation) => {
    const otherParticipant = conversation.participants.find(
      (participant) => String(participant._id || participant) !== String(req.user._id),
    );
    const otherId = String(otherParticipant?._id || otherParticipant);
    if (!otherId) return;

    if (!duplicateGroups.has(otherId)) duplicateGroups.set(otherId, []);
    duplicateGroups.get(otherId).push(conversation);
  });

  if ([...duplicateGroups.values()].some((group) => group.length > 1)) {
    await mergeDuplicateConversationGroups(req.user._id, conversations);
    conversations = await Conversation.find({ participants: req.user._id })
      .populate("participants", "name profile.avatar lastSeenAt")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });
  }

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

  const text = String(req.body.text || "").trim();
  let image = null;
  let audio = null;

  if (req.file) {
    const isImage = req.file.mimetype.startsWith("image/");
    const folder = isImage ? "alapon/chat-images" : "alapon/chat-audio";
    const resourceType = isImage ? "image" : "auto";
    const uploadResult = await uploadBufferToCloudinary(
      req.file.buffer,
      folder,
      resourceType,
    );

    const mediaPayload = {
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      resource_type: uploadResult.resource_type,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
    };

    if (isImage) {
      image = mediaPayload;
    } else {
      audio = mediaPayload;
    }
  }

  if (!text && !image && !audio) {
    return next(new AppError("Message must contain text, image, or audio", 400));
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: req.user._id,
    text,
    image,
    audio,
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
