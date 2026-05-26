import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: ["friend_request", "friend_accept", "message", "post_like", "comment"],
      required: true
    },
    entityType: {
      type: String,
      enum: ["FriendRequest", "Message", "Post", "Comment", "Conversation"]
    },
    entity: { type: mongoose.Schema.Types.ObjectId },
    text: { type: String, default: "" },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
