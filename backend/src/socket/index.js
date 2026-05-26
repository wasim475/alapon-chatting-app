import User from "../models/User.js";

const onlineUsers = new Map();

export const getOnlineUsers = () => new Set(onlineUsers.keys());
export const isUserOnline = (userId) => onlineUsers.has(String(userId));
export const getSocketId = (userId) => onlineUsers.get(String(userId));

const isInteractionBlocked = async (callerId, receiverId) => {
  if (!callerId || !receiverId) return true;
  const [caller, receiver] = await Promise.all([
    User.findById(callerId).select("blockedUsers"),
    User.findById(receiverId).select("blockedUsers"),
  ]);
  if (!caller || !receiver) return true;

  const callerBlocks = Array.isArray(caller.blockedUsers)
    ? caller.blockedUsers.some(
        (blockedId) => String(blockedId) === String(receiverId),
      )
    : false;
  const receiverBlocks = Array.isArray(receiver.blockedUsers)
    ? receiver.blockedUsers.some(
        (blockedId) => String(blockedId) === String(callerId),
      )
    : false;

  return callerBlocks || receiverBlocks;
};

export const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    socket.on("user:join", async (userId) => {
      if (!userId) return;
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);
      socket.join(userId);
      await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });
      io.emit("presence:update", { userId, status: "online" });
    });

    socket.on(
      "typing:start",
      ({ conversationId, receiverId, userId, userName }) => {
        if (!receiverId || !conversationId) return;
        io.to(receiverId).emit("typing:start", {
          conversationId,
          userId,
          userName,
        });
      },
    );

    socket.on("typing:stop", ({ conversationId, receiverId, userId }) => {
      if (!receiverId || !conversationId) return;
      io.to(receiverId).emit("typing:stop", { conversationId, userId });
    });

    socket.on("conversation:join", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(conversationId);
    });

    socket.on("conversation:leave", ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(conversationId);
    });

    socket.on(
      "call:offer",
      async ({
        receiverId,
        conversationId,
        offer,
        isVideo,
        callerId,
        callerName,
      }) => {
        if (!receiverId || !conversationId || !offer) return;
        if (await isInteractionBlocked(socket.userId, receiverId)) return;
        const receiverSocketId = onlineUsers.get(String(receiverId));
        if (!receiverSocketId) return;
        io.to(receiverSocketId).emit("call:incoming", {
          conversationId,
          offer,
          isVideo,
          callerId,
          callerName,
        });
      },
    );

    socket.on("call:answer", async ({ receiverId, conversationId, answer }) => {
      if (!receiverId || !conversationId || !answer) return;
      if (await isInteractionBlocked(socket.userId, receiverId)) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:answer", {
        conversationId,
        answer,
      });
    });

    socket.on(
      "call:candidate",
      async ({ receiverId, conversationId, candidate }) => {
        if (!receiverId || !conversationId || !candidate) return;
        if (await isInteractionBlocked(socket.userId, receiverId)) return;
        const receiverSocketId = onlineUsers.get(String(receiverId));
        if (!receiverSocketId) return;
        io.to(receiverSocketId).emit("call:candidate", {
          conversationId,
          candidate,
        });
      },
    );

    socket.on("call:hangup", async ({ receiverId, conversationId }) => {
      if (!receiverId || !conversationId) return;
      if (await isInteractionBlocked(socket.userId, receiverId)) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:ended", { conversationId });
    });

    socket.on("call:reject", async ({ receiverId, conversationId }) => {
      if (!receiverId || !conversationId) return;
      if (await isInteractionBlocked(socket.userId, receiverId)) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:rejected", { conversationId });
    });

    socket.on(
      "message:seen",
      ({ conversationId, messageId, receiverId, userId }) => {
        io.to(receiverId).emit("message:seen", {
          conversationId,
          messageId,
          userId,
        });
      },
    );

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(
            () => {},
          );
          io.emit("presence:update", { userId, status: "offline" });
          break;
        }
      }
    });
  });
};
