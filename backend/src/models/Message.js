import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    image: { type: String, default: "" },
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    seenBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seenAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
