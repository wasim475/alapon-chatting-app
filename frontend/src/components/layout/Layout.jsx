import {
  Bell,
  Home,
  MessageCircle,
  Moon,
  Search,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useSocket } from "../../context/SocketContext.jsx";
import { api } from "../../lib/api.js";

const navItems = [
  { to: "/", label: "Feed", icon: Home },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/search", label: "Search", icon: Search },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export default function Layout() {
  const { user, logout, setUser } = useAuth();
  const { socket } = useSocket();
  const [dark, setDark] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [friendSearch, setFriendSearch] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [actionRequestId, setActionRequestId] = useState(null);
  const [dropdownError, setDropdownError] = useState("");
  const [dropdownSuccess, setDropdownSuccess] = useState("");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const badgeCount = useMemo(() => {
    const unread = notifications.filter((item) => !item.readAt).length;
    return incomingRequests.length + unread;
  }, [incomingRequests, notifications]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const loadRequestPanel = async () => {
    setLoadingRequests(true);
    setDropdownError("");

    try {
      const [incomingRes, sentRes, notificationRes] = await Promise.all([
        api.get("/friends/requests"),
        api.get("/friends/requests/sent"),
        api.get("/notifications"),
      ]);

      setIncomingRequests(incomingRes.data.requests || []);
      setSentRequests(sentRes.data.requests || []);
      setNotifications(notificationRes.data.notifications || []);
    } catch (err) {
      setDropdownError(
        err?.response?.data?.message || "Unable to load friend requests.",
      );
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleToggleDropdown = () => {
    setDropdownOpen((current) => {
      const next = !current;
      if (!current) {
        loadRequestPanel();
      }
      return next;
    });
  };

  const handleAcceptReject = async (requestId, action) => {
    setActionRequestId(requestId);
    setDropdownError("");
    setDropdownSuccess("");

    try {
      const { data } = await api.patch(`/friends/request/${requestId}`, {
        action,
      });
      setIncomingRequests((current) =>
        current.filter((request) => request._id !== requestId),
      );

      if (action === "accepted") {
        setUser((current) => {
          if (!current) return current;
          return {
            ...current,
            friends: Array.from(
              new Set([
                ...(current.friends || []),
                String(data.request.sender),
              ]),
            ),
          };
        });
        setDropdownSuccess("Friend request accepted.");
      } else {
        setDropdownSuccess("Friend request rejected.");
      }
      loadFriends();
    } catch (err) {
      setDropdownError(
        err?.response?.data?.message || "Unable to update friend request.",
      );
    } finally {
      setActionRequestId(null);
    }
  };

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const { data } = await api.get("/friends/list");
      setFriendsList(data.friends || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (!socket) return undefined;

    const handleNotification = () => {
      loadRequestPanel();
    };

    const handleFriendAccepted = ({ friendId }) => {
      setUser((current) => {
        if (!current) return current;
        return {
          ...current,
          friends: Array.from(new Set([...(current.friends || []), friendId])),
        };
      });
      loadRequestPanel();
    };

    socket.on("notification:new", handleNotification);
    socket.on("friend_request:new", handleNotification);
    socket.on("friend_request:accepted", handleFriendAccepted);
    socket.on("presence:update", ({ userId, status }) => {
      setFriendsList((current) =>
        current.map((friend) => {
          if (String(friend._id) !== String(userId)) return friend;
          return { ...friend, online: status === "online" };
        }),
      );
    });

    return () => {
      socket.off("notification:new", handleNotification);
      socket.off("friend_request:new", handleNotification);
      socket.off("friend_request:accepted", handleFriendAccepted);
      socket.off("presence:update");
    };
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (!dropdownOpen) return undefined;

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    if (!dropdownOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [dropdownOpen]);

  useEffect(() => {
    loadFriends();
  }, []);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <NavLink to="/" className="text-2xl font-black text-brand-600">
            Alapon
          </NavLink>

          <div className="hidden w-full max-w-md items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-slate-900 md:flex">
            <Search size={18} />
            Search friends, posts, and conversations
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={handleToggleDropdown}
                className="relative grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-900"
                type="button"
              >
                <Bell size={19} />
                {badgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {badgeCount}
                  </span>
                )}
              </button>

              {dropdownOpen && (
                <div className="fixed inset-x-3 top-20 z-50 flex justify-center px-4 md:inset-auto md:right-4 md:left-auto md:justify-end md:px-0">
                  <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-semibold">Friend requests</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Manage incoming and sent requests.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {incomingRequests.length} incoming
                        </span>
                        <button
                          type="button"
                          onClick={() => setDropdownOpen(false)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                          aria-label="Close notifications"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {dropdownError && (
                      <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900 dark:text-red-200">
                        {dropdownError}
                      </p>
                    )}
                    {dropdownSuccess && (
                      <p className="m-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-200">
                        {dropdownSuccess}
                      </p>
                    )}

                    <div className="max-h-[calc(100vh-16rem)] overflow-y-auto px-4 pb-4 pt-2 scrollbar-thin">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            Incoming requests
                          </h3>
                          <div className="mt-3 space-y-3">
                            {loadingRequests ? (
                              <p className="text-sm text-slate-500">
                                Loading requests...
                              </p>
                            ) : incomingRequests.length ? (
                              incomingRequests.map((request) => (
                                <div
                                  key={request._id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                      {request.sender?.profile?.avatar ? (
                                        <img
                                          src={request.sender.profile.avatar}
                                          alt={request.sender.name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="grid h-full w-full place-items-center text-sm font-bold text-brand-700 dark:text-brand-100">
                                          {request.sender?.name?.[0]?.toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold">
                                        {request.sender?.name}
                                      </p>
                                      <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Incoming request
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      disabled={actionRequestId === request._id}
                                      onClick={() =>
                                        handleAcceptReject(
                                          request._id,
                                          "accepted",
                                        )
                                      }
                                      className="rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      disabled={actionRequestId === request._id}
                                      onClick={() =>
                                        handleAcceptReject(
                                          request._id,
                                          "rejected",
                                        )
                                      }
                                      className="rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-60"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No incoming requests at the moment.
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            Sent requests
                          </h3>
                          <div className="mt-3 space-y-3">
                            {loadingRequests ? (
                              <p className="text-sm text-slate-500">
                                Loading requests...
                              </p>
                            ) : sentRequests.length ? (
                              sentRequests.map((request) => (
                                <div
                                  key={request._id}
                                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                      {request.receiver?.profile?.avatar ? (
                                        <img
                                          src={request.receiver.profile.avatar}
                                          alt={request.receiver.name}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="grid h-full w-full place-items-center text-sm font-bold text-brand-700 dark:text-brand-100">
                                          {request.receiver?.name?.[0]?.toUpperCase()}
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate font-semibold">
                                        {request.receiver?.name}
                                      </p>
                                      <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Pending request
                                      </p>
                                    </div>
                                  </div>
                                  <span className="rounded-full bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    Pending
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No sent requests pending.
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            Notifications
                          </h3>
                          <div className="mt-3 space-y-3">
                            {loadingRequests ? (
                              <p className="text-sm text-slate-500">
                                Loading notifications...
                              </p>
                            ) : notifications.length ? (
                              notifications.map((notification) => (
                                <div
                                  key={notification._id}
                                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                                >
                                  <p className="text-sm font-semibold">
                                    {notification.text}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {notification.readAt ? "Read" : "New"}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No notifications right now.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={toggleTheme}
              className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-900"
              title="Toggle dark mode"
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              onClick={logout}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 pb-24 lg:grid-cols-[240px_minmax(0,1fr)_280px] lg:pb-0">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-2">
            <NavLink
              to={`/profile/${user._id}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <UserRound size={20} />
              {user.name}
            </NavLink>
            {navItems.map(({ to, label, icon: Icon }) => {
              const path = to === "/profile" ? `/profile/${user._id}` : to;
              return (
                <NavLink
                  key={to}
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 font-medium ${
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-slate-900 dark:text-brand-100"
                        : "hover:bg-slate-100 dark:hover:bg-slate-900"
                    }`
                  }
                >
                  <Icon size={20} />
                  {label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">Contacts</h2>
                <button
                  type="button"
                  onClick={() => navigate("/friends")}
                  className="text-xs font-semibold text-brand-600"
                >
                  Manage
                </button>
              </div>
              <div className="mt-3">
                <input
                  value={friendSearch}
                  onChange={(event) => setFriendSearch(event.target.value)}
                  placeholder="Search friends"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-800 dark:bg-slate-950"
                />
              </div>
              <div className="mt-4 space-y-3 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
                {loadingFriends ? (
                  <p className="text-sm text-slate-500">Loading friends...</p>
                ) : friendsList.length ? (
                  friendsList
                    .filter((friend) =>
                      friend.name
                        .toLowerCase()
                        .includes(friendSearch.toLowerCase()),
                    )
                    .slice(0, 8)
                    .map((friend) => (
                      <div
                        key={friend._id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                            {friend.profile?.avatar ? (
                              <img
                                src={friend.profile.avatar}
                                alt={friend.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-sm font-bold text-brand-700 dark:text-brand-100">
                                {friend.name?.[0]?.toUpperCase()}
                              </div>
                            )}
                            <span
                              className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ring-2 ring-white dark:ring-slate-950 ${
                                friend.online
                                  ? "bg-emerald-500"
                                  : "bg-slate-400"
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">
                              {friend.name}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {friend.online
                                ? "Online"
                                : `Last seen ${new Date(friend.lastSeenAt).toLocaleString()}`}
                            </p>
                          </div>
                          {friend.unreadCount > 0 && (
                            <span className="rounded-full bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white">
                              {friend.unreadCount}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/messages?user=${friend._id}`)
                            }
                            className="flex-1 rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Message
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                          >
                            Call
                          </button>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    You have no friends yet. Search to connect.
                  </p>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          {navItems.map(({ to, label, icon: Icon }) => {
            const path = to === "/profile" ? `/profile/${user._id}` : to;
            return (
              <NavLink
                key={to}
                to={path}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-semibold transition-colors ${
                    isActive
                      ? "text-brand-600"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
