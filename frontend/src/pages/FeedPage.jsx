import { ImagePlus, Send } from "lucide-react";
import React, { useEffect, useState } from "react";
import PostCard from "../components/post/PostCard.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export default function FeedPage() {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = async () => {
    const { data } = await api.get("/posts/feed");
    setPosts(data.posts);
    setLoading(false);
  };

  useEffect(() => {
    loadFeed().catch(() => setLoading(false));
  }, []);

  const submitPost = async (event) => {
    event.preventDefault();
    if (!text.trim()) return;

    const { data } = await api.post("/posts", { text, visibility: "friends" });
    setPosts((current) => [data.post, ...current]);
    setText("");
  };

  const likePost = async (postId) => {
    const { data } = await api.post(`/posts/${postId}/like`);
    setPosts((current) => current.map((post) => (post._id === postId ? data.post : post)));
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form onSubmit={submitPost} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-3">
          <Avatar src={user.profile?.avatar} name={user.name} />
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`What's on your mind, ${user.name.split(" ")[0]}?`}
            className="min-h-24 flex-1 resize-none rounded-lg bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-950"
          />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
          <button type="button" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <ImagePlus size={18} />
            Photo
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
            <Send size={17} />
            Post
          </button>
        </div>
      </form>

      {loading ? (
        <p className="rounded-lg bg-white p-6 text-center text-slate-500 dark:bg-slate-900">Loading feed...</p>
      ) : posts.length ? (
        posts.map((post) => <PostCard key={post._id} post={post} onLike={likePost} />)
      ) : (
        <p className="rounded-lg bg-white p-6 text-center text-slate-500 dark:bg-slate-900">
          Your feed is quiet. Add friends or publish the first post.
        </p>
      )}
    </div>
  );
}
