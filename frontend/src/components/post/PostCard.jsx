import { MessageCircle, ThumbsUp } from "lucide-react";
import React, { useState } from "react";
import Avatar from "../ui/Avatar.jsx";
import CommentSection from "./CommentSection.jsx";

export default function PostCard({ post, onLike }) {
  const [commentCount, setCommentCount] = useState(post.commentCount || 0);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <Avatar src={post.author?.profile?.avatar} name={post.author?.name} />
        <div>
          <h3 className="font-semibold">{post.author?.name}</h3>
          <p className="text-xs text-slate-500">
            {new Date(post.createdAt).toLocaleString()}
          </p>
        </div>
      </div>
      {post.text && (
        <p className="mt-4 whitespace-pre-wrap leading-relaxed">{post.text}</p>
      )}
      {post.images?.length > 0 && (
        <div className="mt-4 grid gap-2 overflow-hidden rounded-lg">
          {post.images.map((image) => (
            <img
              key={image}
              src={image}
              alt=""
              className="max-h-[520px] w-full object-cover"
            />
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <button
          onClick={() => onLike(post._id)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ThumbsUp size={18} />
          Like {post.likes?.length ? `(${post.likes.length})` : ""}
        </button>
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
          <MessageCircle size={18} />
          Comments {commentCount ? `(${commentCount})` : ""}
        </div>
      </div>
      <div className="mt-4">
        <CommentSection
          postId={post._id}
          initialCount={commentCount}
          onCountChange={setCommentCount}
        />
      </div>
    </article>
  );
}
