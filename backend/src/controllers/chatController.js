import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { getSocketId, isUserOnline } from "../socket/index.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

const normalizeParticipantIds = (ids) => ids.map((id) => String(id)).sort();

const isUserBlocking = (user, otherId) =>
  Array.isArray(user.blockedUsers) &&
  user.blockedUsers.some((blockedId) => String(blockedId) === String(otherId));

const getOtherParticipantId = (conversation, userId) =>
  conversation.participants.find(
    (participant) => String(participant._id || participant) !== String(userId),
  )?._id || null;

const mergeDuplicateConversations = async (conversations) => {
  const sorted = conversations.sort(
    (a, b) =>
      new Date(b.lastMessageAt || b.createdAt) -
      new Date(a.lastMessageAt || a.createdAt),
  );

  const primary = sorted[0];
  const duplicates = sorted.slice(1);
  const duplicateIds = duplicates.map((conversation) => conversation._id);

  for (const duplicate of duplicates) {
    const existing = new Map(primary.unreadCounts || []);
    const duplicateCounts = duplicate.unreadCounts || {};

    Object.entries(duplicateCounts).forEach(([userId, count]) => {
      existing.set(userId, (existing.get(userId) || 0) + count);
    });

    primary.unreadCounts = existing;
    await primary.save();
  }

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
      (participant) =>
        String(participant._id || participant) !== String(userId),
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
  const user = await User.findById(req.user._id).select("friends blockedUsers");

  if (!user.friends.some((id) => String(id) === friendId)) {
    return next(new AppError("You can only chat with friends", 403));
  }

  if (isUserBlocking(user, friendId)) {
    return next(
      new AppError("You cannot chat with a user you have blocked", 403),
    );
  }

  const friend = await User.findById(friendId).select("blockedUsers");
  if (!friend) return next(new AppError("User not found", 404));

  if (isUserBlocking(friend, req.user._id)) {
    return next(new AppError("This user has blocked you", 403));
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

  await conversation.populate("participants", "name profile.avatar lastSeenAt");

  res.json({ status: "success", conversation });
});

export const listConversations = catchAsync(async (req, res) => {
  const currentUser = await User.findById(req.user._id).select("blockedUsers");
  let conversations = await Conversation.find({ participants: req.user._id })
    .populate("participants", "name profile.avatar lastSeenAt blockedUsers")
    .populate("lastMessage")
    .sort({ lastMessageAt: -1 });

  conversations = conversations.filter((conversation) => {
    const otherParticipant = conversation.participants.find(
      (participant) => String(participant._id) !== String(req.user._id),
    );
    if (!otherParticipant) return true;
    if (isUserBlocking(currentUser, otherParticipant._id)) return false;
    if (isUserBlocking(otherParticipant, req.user._id)) return false;
    return true;
  });

  const duplicateGroups = new Map();

  conversations.forEach((conversation) => {
    const otherParticipant = conversation.participants.find(
      (participant) =>
        String(participant._id || participant) !== String(req.user._id),
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

  const conversationsWithUnread = conversations.map((conversation) => {
    const conversationObject = conversation.toObject();
    const partner = conversationObject.participants.find(
      (participant) => String(participant._id) !== String(req.user._id),
    );
    if (partner) {
      partner.online = isUserOnline(partner._id);
    }

    let storedUnread = 0;
    if (conversation.unreadCounts) {
      if (typeof conversation.unreadCounts.get === "function") {
        storedUnread = conversation.unreadCounts.get(String(req.user._id)) || 0;
      } else {
        storedUnread = conversation.unreadCounts[String(req.user._id)] || 0;
      }
    }

    return {
      ...conversationObject,
      unreadCount: storedUnread || unreadMap.get(String(conversation._id)) || 0,
    };
  });

  res.json({ status: "success", conversations: conversationsWithUnread });
});

export const listMessages = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  }).populate("participants", "blockedUsers");

  if (!conversation) return next(new AppError("Conversation not found", 404));

  const otherParticipantId = getOtherParticipantId(conversation, req.user._id);
  if (!otherParticipantId)
    return next(new AppError("Invalid conversation participants", 400));

  if (isUserBlocking(req.user, otherParticipantId)) {
    return next(
      new AppError("You cannot view messages for a blocked conversation", 403),
    );
  }

  const otherParticipant = conversation.participants.find(
    (participant) => String(participant._id) === String(otherParticipantId),
  );
  if (otherParticipant && isUserBlocking(otherParticipant, req.user._id)) {
    return next(
      new AppError("You cannot view messages for a blocked conversation", 403),
    );
  }

  const messages = await Message.find({
    conversation: req.params.conversationId,
  })
    .populate("sender", "name profile.avatar")
    .sort({ createdAt: 1 })
    .limit(80);

  res.json({ status: "success", messages });
});

const updateConversationLastMessage = async (conversation) => {
  const lastMessage = await Message.findOne({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .select("_id createdAt");

  if (lastMessage) {
    conversation.lastMessage = lastMessage._id;
    conversation.lastMessageAt = lastMessage.createdAt;
  } else {
    conversation.lastMessage = null;
    conversation.lastMessageAt = conversation.createdAt || new Date();
  }
  await conversation.save();
};

export const markConversationRead = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  }).populate("participants", "blockedUsers");

  if (!conversation) return next(new AppError("Conversation not found", 404));

  const otherParticipantId = getOtherParticipantId(conversation, req.user._id);
  if (!otherParticipantId) {
    return next(new AppError("Invalid conversation participants", 400));
  }

  if (isUserBlocking(req.user, otherParticipantId)) {
    return next(
      new AppError("You cannot mark a blocked conversation as read", 403),
    );
  }

  const otherParticipant = conversation.participants.find(
    (participant) => String(participant._id) === String(otherParticipantId),
  );
  if (otherParticipant && isUserBlocking(otherParticipant, req.user._id)) {
    return next(
      new AppError("You cannot mark a blocked conversation as read", 403),
    );
  }

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

  conversation.unreadCounts = conversation.unreadCounts || new Map();
  if (typeof conversation.unreadCounts.set === "function") {
    conversation.unreadCounts.set(String(req.user._id), 0);
  } else {
    conversation.unreadCounts[String(req.user._id)] = 0;
  }
  await conversation.save();

  const io = req.app.get("io");
  io.to(String(conversation._id)).emit("message:read", {
    conversationId: String(conversation._id),
    userId: String(req.user._id),
  });

  io.to(String(req.user._id)).emit("message:read", {
    conversationId: String(conversation._id),
    userId: String(req.user._id),
  });

  if (otherParticipantId) {
    io.to(String(otherParticipantId)).emit("message:read", {
      conversationId: String(conversation._id),
      userId: String(req.user._id),
    });
  }

  res.json({ status: "success" });
});

export const editMessage = catchAsync(async (req, res, next) => {
  const { text } = req.body;
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  });

  if (!conversation) return next(new AppError("Conversation not found", 404));
  const message = await Message.findOne({
    _id: req.params.messageId,
    conversation: conversation._id,
    sender: req.user._id,
    isUnsent: false,
  });

  if (!message) {
    return next(new AppError("Message not found or not editable", 404));
  }

  const trimmedText = String(text || "").trim();
  if (!trimmedText) {
    return next(new AppError("Message text cannot be empty", 400));
  }

  message.text = trimmedText;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();
  await message.populate("sender", "name profile.avatar");

  const io = req.app.get("io");
  io.to(String(conversation._id)).emit("message:edited", message);

  res.json({ status: "success", message });
});

export const deleteMessage = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  });

  if (!conversation) return next(new AppError("Conversation not found", 404));

  const message = await Message.findOneAndDelete({
    _id: req.params.messageId,
    conversation: conversation._id,
    sender: req.user._id,
  });

  if (!message) {
    return next(new AppError("Message not found or not deletable", 404));
  }

  if (String(conversation.lastMessage) === String(message._id)) {
    await updateConversationLastMessage(conversation);
  }

  const io = req.app.get("io");
  io.to(String(conversation._id)).emit("message:deleted", {
    conversationId: String(conversation._id),
    messageId: String(message._id),
  });

  res.json({ status: "success" });
});

export const unsendMessage = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  });

  if (!conversation) return next(new AppError("Conversation not found", 404));

  const message = await Message.findOne({
    _id: req.params.messageId,
    conversation: conversation._id,
    sender: req.user._id,
    isUnsent: false,
  });

  if (!message) {
    return next(new AppError("Message not found or already unsent", 404));
  }

  message.text = "This message was unsent";
  message.image = null;
  message.audio = null;
  message.isUnsent = true;
  message.isEdited = false;
  message.editedAt = new Date();
  await message.save();
  await message.populate("sender", "name profile.avatar");

  const io = req.app.get("io");
  io.to(String(conversation._id)).emit("message:unsent", message);

  res.json({ status: "success", message });
});

export const sendMessage = catchAsync(async (req, res, next) => {
  const conversation = await Conversation.findOne({
    _id: req.params.conversationId,
    participants: req.user._id,
  }).populate("participants", "blockedUsers");

  if (!conversation) return next(new AppError("Conversation not found", 404));

  const otherParticipantId = getOtherParticipantId(conversation, req.user._id);
  if (!otherParticipantId) {
    return next(new AppError("Invalid conversation participants", 400));
  }

  if (isUserBlocking(req.user, otherParticipantId)) {
    return next(
      new AppError("You cannot send messages to a blocked user", 403),
    );
  }

  const otherParticipant = conversation.participants.find(
    (participant) => String(participant._id) === String(otherParticipantId),
  );
  if (otherParticipant && isUserBlocking(otherParticipant, req.user._id)) {
    return next(new AppError("This user has blocked you", 403));
  }

  const text = String(req.body.text || "").trim();
  let image = null;
  let audio = null;

  if (req.file) {
    const isImage = req.file.mimetype.startsWith("image/");
    const isAudio = req.file.mimetype.startsWith("audio/");

    if (!isImage && !isAudio) {
      return next(new AppError("Unsupported media type", 400));
    }

    const folder = isImage ? "alapon/chat-images" : "alapon/chat-audio";
    const resourceType = isImage ? "image" : "audio";
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
    return next(
      new AppError("Message must contain text, image, or audio", 400),
    );
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
  conversation.unreadCounts = conversation.unreadCounts || new Map();
  const receiverId = String(otherParticipantId);
  const existingUnread =
    typeof conversation.unreadCounts.get === "function"
      ? conversation.unreadCounts.get(receiverId) || 0
      : conversation.unreadCounts[receiverId] || 0;

  if (typeof conversation.unreadCounts.set === "function") {
    conversation.unreadCounts.set(receiverId, existingUnread + 1);
  } else {
    conversation.unreadCounts[receiverId] = existingUnread + 1;
  }

  await conversation.save();
  await message.populate("sender", "name profile.avatar");

  const io = req.app.get("io");
  const senderSocketId = getSocketId(req.user._id);

  if (senderSocketId && typeof io.to === "function") {
    io.to(String(conversation._id))
      .except(senderSocketId)
      .emit("message:new", message);
  } else {
    io.to(String(conversation._id)).emit("message:new", message);
  }

  const receiverSocketId = getSocketId(otherParticipantId);
  if (receiverSocketId) {
    io.to(String(otherParticipantId)).emit("conversation:updated", {
      conversationId: String(conversation._id),
      lastMessage: message,
      lastMessageAt: message.createdAt,
      unreadIncrement: 1,
    });
  }

  res.status(201).json({ status: "success", message });
});
