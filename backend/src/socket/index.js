import User from "../models/User.js";

const onlineUsers = new Map();

export const registerSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    socket.on("user:join", async (userId) => {
      if (!userId) return;
      onlineUsers.set(userId, socket.id);
      socket.join(userId);
      await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() });
      io.emit("presence:update", { userId, status: "online" });
    });

    socket.on("typing:start", ({ conversationId, receiverId, userId }) => {
      io.to(receiverId).emit("typing:start", { conversationId, userId });
    });

    socket.on("typing:stop", ({ conversationId, receiverId, userId }) => {
      io.to(receiverId).emit("typing:stop", { conversationId, userId });
    });

    socket.on("message:seen", ({ conversationId, messageId, receiverId, userId }) => {
      io.to(receiverId).emit("message:seen", {
        conversationId,
        messageId,
        userId
      });
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers.entries()) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(() => {});
          io.emit("presence:update", { userId, status: "offline" });
          break;
        }
      }
    });
  });
};
