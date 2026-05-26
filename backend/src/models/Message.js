import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    public_id: { type: String, required: true },
    format: { type: String, required: true },
    bytes: { type: Number, required: true },
    resource_type: { type: String, required: true },
    width: Number,
    height: Number,
    duration: Number,
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, maxlength: 2000, default: "" },
    image: { type: mediaSchema, default: null },
    audio: { type: mediaSchema, default: null },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    isUnsent: { type: Boolean, default: false },
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    seenBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        seenAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export default mongoose.model("Message", messageSchema);
