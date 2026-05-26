import User from "../models/User.js";

const onlineUsers = new Map();

export const getOnlineUsers = () => new Set(onlineUsers.keys());
export const isUserOnline = (userId) => onlineUsers.has(String(userId));
export const getSocketId = (userId) => onlineUsers.get(String(userId));

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

    socket.on("typing:start", ({ conversationId, receiverId, userId, userName }) => {
      if (!receiverId || !conversationId) return;
      io.to(receiverId).emit("typing:start", { conversationId, userId, userName });
    });

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

    socket.on("call:offer", ({ receiverId, conversationId, offer, isVideo, callerId, callerName }) => {
      if (!receiverId || !conversationId || !offer) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:incoming", {
        conversationId,
        offer,
        isVideo,
        callerId,
        callerName,
      });
    });

    socket.on("call:answer", ({ receiverId, conversationId, answer }) => {
      if (!receiverId || !conversationId || !answer) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:answer", {
        conversationId,
        answer,
      });
    });

    socket.on("call:candidate", ({ receiverId, conversationId, candidate }) => {
      if (!receiverId || !conversationId || !candidate) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:candidate", {
        conversationId,
        candidate,
      });
    });

    socket.on("call:hangup", ({ receiverId, conversationId }) => {
      if (!receiverId || !conversationId) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (!receiverSocketId) return;
      io.to(receiverSocketId).emit("call:ended", { conversationId });
    });

    socket.on("call:reject", ({ receiverId, conversationId }) => {
      if (!receiverId || !conversationId) return;
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
