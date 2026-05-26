import { MessageCircle, Users } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import { api } from "../lib/api.js";

export default function FriendsPage() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  useEffect(() => {
    api
      .get("/friends/list")
      .then(({ data }) => {
        setFriends(data.friends || []);
      })
      .catch(() => {
        setError("Unable to load friends. Please try again.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const removeFriend = async (id) => {
    setActionError(null);
    setActionSuccess(null);
    setActioningId(id);

    try {
      await api.delete(`/friends/${id}`);
      setFriends((current) => current.filter((friend) => friend._id !== id));
      setActionSuccess("Friend removed.");
    } catch (err) {
      setActionError(err?.response?.data?.message || "Unable to remove friend.");
    } finally {
      setActioningId(null);
    }
  };

  const blockUser = async (id) => {
    setActionError(null);
    setActionSuccess(null);
    setActioningId(id);

    try {
      await api.post(`/friends/block/${id}`);
      setFriends((current) => current.filter((friend) => friend._id !== id));
      setActionSuccess("User blocked and removed from friends.");
    } catch (err) {
      setActionError(err?.response?.data?.message || "Unable to block user.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 sm:px-0">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-brand-600" />
          <div>
            <h1 className="text-xl font-semibold">Friends</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect with people you know and manage your network.
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {actionSuccess}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading friends...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950">
          {error}
        </div>
      ) : friends.length ? (
        <div className="space-y-4">
          {friends.map((friend) => (
            <div
              key={friend._id}
              className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar src={friend.profile?.avatar} name={friend.name} />
                  <span
                    className={`absolute right-0 bottom-0 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${
                      friend.online ? "bg-emerald-500" : "bg-slate-400"
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold">
                    {friend.name}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {friend.online ? "Online now" : "Offline"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/messages?user=${friend._id}`)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <MessageCircle size={16} /> Message
                </button>
                <button
                  type="button"
                  onClick={() => removeFriend(friend._id)}
                  disabled={actioningId === friend._id}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Unfriend
                </button>
                <button
                  type="button"
                  onClick={() => blockUser(friend._id)}
                  disabled={actioningId === friend._id}
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200 dark:hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Block
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          You have no friends yet. Visit Search to connect with new people.
        </div>
      )}
    </div>
  );
}
