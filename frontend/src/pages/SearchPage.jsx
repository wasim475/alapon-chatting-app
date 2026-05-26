import { UserPlus } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import Avatar from "../components/ui/Avatar.jsx";
import { api } from "../lib/api.js";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestingId, setRequestingId] = useState(null);
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");
  const debounceRef = useRef(null);
  const abortControllerRef = useRef(null);

  const loadUsers = async (query) => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setUsers([]);
      setError("");
      setLoading(false);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const { data } = await api.get("/users/search", {
        params: { q: trimmedQuery },
        signal: controller.signal,
      });
      setUsers(data.users || []);
    } catch (err) {
      if (err.name === "CanceledError") return;
      setUsers([]);
      setError(
        err?.response?.data?.message || "Unable to load search results.",
      );
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    loadUsers(q);
  };

  useEffect(() => {
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      loadUsers(q);
    }, 350);

    return () => clearTimeout(debounceRef.current);
  }, [q]);

  const sendRequest = async (id) => {
    if (!id) return;

    setRequestError("");
    setRequestSuccess("");
    setRequestingId(id);

    try {
      await api.post(`/friends/request/${id}`);
      setUsers((current) => current.filter((person) => person._id !== id));
      setRequestSuccess("Friend request sent.");
    } catch (err) {
      setRequestError(
        err?.response?.data?.message || "Unable to send friend request.",
      );
    } finally {
      setRequestingId(null);
    }
  };

  const showEmptyState =
    !loading &&
    q.trim().length > 0 &&
    users.length === 0 &&
    !error &&
    !requestError;

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name or email"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500 dark:border-slate-800 dark:bg-slate-900"
        />
        <button className="rounded-lg bg-brand-600 px-5 font-bold text-white">
          Search
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Loading users...
          </div>
        )}

        {(error || requestError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-center text-sm text-red-700 dark:border-red-800 dark:bg-red-900 dark:text-red-200">
            {error || requestError}
          </div>
        )}

        {requestSuccess && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center text-sm text-green-700 dark:border-green-800 dark:bg-green-900 dark:text-green-200">
            {requestSuccess}
          </div>
        )}

        {showEmptyState && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No users found for "{q.trim()}".
          </div>
        )}

        {users.map((person) => (
          <div
            key={person._id}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3">
              <Avatar src={person.profile?.avatar} name={person.name} />
              <div>
                <h2 className="font-semibold">{person.name}</h2>
                <p className="text-sm text-slate-500">{person.email}</p>
              </div>
            </div>
            <button
              onClick={() => sendRequest(person._id)}
              disabled={requestingId === person._id}
              className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus size={18} />
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
