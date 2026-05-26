import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, trim: true, maxlength: 5000, default: "" },
    images: [{ type: String }],
    visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "friends"
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    commentCount: { type: Number, default: 0 },
    isEdited: { type: Boolean, default: false }
  },
  { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

export default mongoose.model("Post", postSchema);
