import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    lastMessageAt: { type: Date, default: Date.now },
  unreadCounts: {
    type: Map,
    of: Number,
    default: {},
  },
);

conversationSchema.pre("save", function (next) {
  if (!Array.isArray(this.participants)) return next();
  this.participants = this.participants
    .map((participant) => mongoose.Types.ObjectId(String(participant)))
    .sort((a, b) => String(a).localeCompare(String(b)));
  next();
});

conversationSchema.index(
  { participants: 1 },
  { unique: true, partialFilterExpression: { participants: { $size: 2 } } },
);
conversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model("Conversation", conversationSchema);
