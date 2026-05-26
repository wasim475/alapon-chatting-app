import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import Notification from "../models/Notification.js";
import Post from "../models/Post.js";
import { AppError } from "../utils/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { uploadBufferToCloudinary } from "../utils/uploadToCloudinary.js";

export const createPost = catchAsync(async (req, res) => {
  const images = [];

  if (req.files?.length) {
    for (const file of req.files) {
      images.push(await uploadBufferToCloudinary(file.buffer, "alapon/posts"));
    }
  }

  const post = await Post.create({
    author: req.user._id,
    text: req.body.text,
    images,
    visibility: req.body.visibility || "friends",
  });

  await post.populate("author", "name profile.avatar");
  res.status(201).json({ status: "success", post });
});

export const getFeed = catchAsync(async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 10), 30);
  const visibleAuthors = [req.user._id, ...req.user.friends];

  const posts = await Post.find({
    $or: [
      { visibility: "public" },
      { visibility: "friends", author: { $in: visibleAuthors } },
      { visibility: "private", author: req.user._id },
    ],
  })
    .populate("author", "name profile.avatar")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  res.json({ status: "success", page, posts });
});

export const toggleLike = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return next(new AppError("Post not found", 404));

  const liked = post.likes.some((id) => String(id) === String(req.user._id));
  const update = liked
    ? { $pull: { likes: req.user._id } }
    : { $addToSet: { likes: req.user._id } };

  const updated = await Post.findByIdAndUpdate(post._id, update, { new: true });

  if (!liked && String(post.author) !== String(req.user._id)) {
    await Notification.create({
      recipient: post.author,
      sender: req.user._id,
      type: "post_like",
      entityType: "Post",
      entity: post._id,
      text: `${req.user.name} liked your post`,
    });
  }

  res.json({ status: "success", post: updated });
});

export const addComment = catchAsync(async (req, res, next) => {
  const post = await Post.findById(req.params.postId);
  if (!post) return next(new AppError("Post not found", 404));

  const parentCommentId = req.body.parentCommentId || null;
  if (parentCommentId && !mongoose.isValidObjectId(parentCommentId)) {
    return next(new AppError("Invalid parent comment", 400));
  }

  if (parentCommentId) {
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment || String(parentComment.post) !== String(post._id)) {
      return next(new AppError("Parent comment not found", 404));
    }
  }

  const comment = await Comment.create({
    post: post._id,
    author: req.user._id,
    text: req.body.text,
    parentComment: parentCommentId,
  });

  await Post.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });
  await comment.populate("author", "name profile.avatar");

  if (String(post.author) !== String(req.user._id)) {
    await Notification.create({
      recipient: post.author,
      sender: req.user._id,
      type: "comment",
      entityType: "Comment",
      entity: comment._id,
      text: `${req.user.name} commented on your post`,
    });
  }

  req.app.get("io")?.emit("comment:new", {
    postId: String(post._id),
    comment,
  });

  res.status(201).json({ status: "success", comment });
});

export const getComments = catchAsync(async (req, res) => {
  const comments = await Comment.find({ post: req.params.postId })
    .populate("author", "name profile.avatar")
    .sort({ createdAt: 1 });

  const tree = [];
  const map = new Map();

  comments.forEach((comment) => {
    const commentObj = { ...comment.toObject(), replies: [] };
    map.set(String(comment._id), commentObj);
  });

  comments.forEach((comment) => {
    const commentObj = map.get(String(comment._id));
    if (comment.parentComment) {
      const parent = map.get(String(comment.parentComment));
      if (parent) {
        parent.replies.push(commentObj);
        return;
      }
    }
    tree.push(commentObj);
  });

  res.json({ status: "success", comments: tree });
});

const collectCommentDescendants = async (rootId) => {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i += 1) {
    const children = await Comment.find({ parentComment: ids[i] })
      .select("_id")
      .lean();
    children.forEach((child) => ids.push(child._id));
  }
  return ids;
};

export const deleteComment = catchAsync(async (req, res, next) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) return next(new AppError("Comment not found", 404));
  if (String(comment.author) !== String(req.user._id)) {
    return next(new AppError("Not authorized to delete this comment", 403));
  }

  const idsToDelete = await collectCommentDescendants(comment._id);
  await Comment.deleteMany({ _id: { $in: idsToDelete } });
  await Post.findByIdAndUpdate(comment.post, {
    $inc: { commentCount: -idsToDelete.length },
  });

  req.app.get("io")?.emit("comment:deleted", {
    postId: String(comment.post),
    commentId: String(comment._id),
    deletedIds: idsToDelete.map((id) => String(id)),
  });

  res.json({
    status: "success",
    deletedIds: idsToDelete.map((id) => String(id)),
  });
});

export const updatePost = catchAsync(async (req, res, next) => {
  const post = await Post.findOneAndUpdate(
    { _id: req.params.postId, author: req.user._id },
    { text: req.body.text, isEdited: true },
    { new: true, runValidators: true },
  );

  if (!post) return next(new AppError("Post not found", 404));
  res.json({ status: "success", post });
});

export const deletePost = catchAsync(async (req, res, next) => {
  const post = await Post.findOneAndDelete({
    _id: req.params.postId,
    author: req.user._id,
  });

  if (!post) return next(new AppError("Post not found", 404));
  await Comment.deleteMany({ post: post._id });
  res.json({ status: "success" });
});
