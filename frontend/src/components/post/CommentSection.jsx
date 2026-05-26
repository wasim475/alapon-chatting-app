import { CornerDownRight, Send } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useSocket } from "../../context/SocketContext.jsx";
import { api } from "../../lib/api.js";
import Avatar from "../ui/Avatar.jsx";

const buildTree = (comments) => {
  const map = new Map();
  const topLevel = [];

  comments.forEach((comment) => {
    const commentObj = { ...comment, replies: comment.replies || [] };
    map.set(commentObj._id, commentObj);
  });

  comments.forEach((comment) => {
    if (comment.parentComment) {
      const parent = map.get(comment.parentComment);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(map.get(comment._id));
        return;
      }
    }
    topLevel.push(map.get(comment._id));
  });

  return topLevel;
};

const appendReply = (tree, comment) => {
  if (!comment.parentComment) {
    return [comment, ...tree];
  }

  return tree.map((item) => {
    if (item._id === comment.parentComment) {
      return {
        ...item,
        replies: [...(item.replies || []), comment],
      };
    }

    if (item.replies?.length) {
      return {
        ...item,
        replies: appendReply(item.replies, comment),
      };
    }

    return item;
  });
};

const removeComment = (tree, commentId) =>
  tree
    .filter((item) => item._id !== commentId)
    .map((item) => ({
      ...item,
      replies: item.replies ? removeComment(item.replies, commentId) : [],
    }));

const formatTime = (value) => new Date(value).toLocaleString();

const CommentItem = ({ comment, onReply }) => (
  <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
    <div className="flex items-start gap-3">
      <Avatar
        src={comment.author?.profile?.avatar}
        name={comment.author?.name}
        size="sm"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold">{comment.author?.name}</p>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {formatTime(comment.createdAt)}
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {comment.text}
        </p>
        <button
          type="button"
          onClick={() => onReply(comment)}
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
        >
          <CornerDownRight size={16} /> Reply
        </button>
      </div>
    </div>
    {comment.replies?.length > 0 && (
      <div className="space-y-3 border-l border-slate-200 pl-4 dark:border-slate-800">
        {comment.replies.map((reply) => (
          <CommentItem key={reply._id} comment={reply} onReply={onReply} />
        ))}
      </div>
    )}
  </div>
);

export default function CommentSection({
  postId,
  initialCount = 0,
  onCountChange,
}) {
  const { socket } = useSocket();
  const [comments, setComments] = useState([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCount);

  useEffect(() => {
    onCountChange?.(commentCount);
  }, [commentCount, onCountChange]);

  const loadComments = async () => {
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get(`/posts/${postId}/comments`);
      setComments(buildTree(data.comments || []));
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load comments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    loadComments();
  }, [visible]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNewComment = ({ postId: eventPostId, comment }) => {
      if (String(eventPostId) !== String(postId)) return;
      setComments((current) => appendReply(current, comment));
      setCommentCount((current) => current + 1);
    };

    const handleDeletedComment = ({ postId: eventPostId, deletedIds }) => {
      if (String(eventPostId) !== String(postId)) return;
      setComments((current) =>
        deletedIds.reduce((tree, id) => removeComment(tree, id), current),
      );
      setCommentCount((current) => Math.max(0, current - deletedIds.length));
    };

    socket.on("comment:new", handleNewComment);
    socket.on("comment:deleted", handleDeletedComment);

    return () => {
      socket.off("comment:new", handleNewComment);
      socket.off("comment:deleted", handleDeletedComment);
    };
  }, [socket, postId]);

  const submitComment = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const payload = { text: text.trim() };
      if (replyTo) payload.parentCommentId = replyTo._id;
      const { data } = await api.post(`/posts/${postId}/comments`, payload);
      setText("");
      setReplyTo(null);
      setComments((current) =>
        appendReply(current, { ...data.comment, replies: [] }),
      );
      setCommentCount((current) => current + 1);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span>Comments {commentCount ? `(${commentCount})` : ""}</span>
        <span className="text-brand-600">{visible ? "Hide" : "Show"}</span>
      </button>

      {visible && (
        <div className="space-y-4">
          <form onSubmit={submitComment} className="space-y-3">
            {replyTo && (
              <div className="flex items-center justify-between rounded-3xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                Replying to {replyTo.author?.name}
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-brand-600 hover:text-brand-700"
                >
                  Cancel
                </button>
              </div>
            )}
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              placeholder={
                replyTo
                  ? `Reply to ${replyTo.author?.name}`
                  : "Write a comment..."
              }
              className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
                {submitting ? "Posting..." : "Post comment"}
              </button>
            </div>
          </form>

          {error && (
            <p className="rounded-3xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {error}
            </p>
          )}

          {loading ? (
            <p className="rounded-3xl bg-slate-50 px-4 py-6 text-center text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              Loading comments...
            </p>
          ) : comments.length ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <CommentItem
                  key={comment._id}
                  comment={comment}
                  onReply={setReplyTo}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-3xl bg-slate-50 px-4 py-6 text-center text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              No comments yet. Be the first to reply.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
