import { Send } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { api } from "../lib/api.js";

export default function MessagesPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const friendId = searchParams.get("user");
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const otherParticipant = (conversation) =>
    conversation?.participants?.find(
      (participant) => participant._id !== user._id,
    );

  const loadConversations = async () => {
    setLoadingConversations(true);
    setError("");

    try {
      const { data } = await api.get("/chats/conversations");
      setConversations(data.conversations || []);
      if (!friendId) {
        setActive(data.conversations?.[0] || null);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load conversations.");
    } finally {
      setLoadingConversations(false);
    }
  };

  const openConversationForFriend = async (friendIdToOpen) => {
    if (!friendIdToOpen) return;

    const existing = conversations.find((conversation) =>
      conversation.participants.some(
        (participant) => String(participant._id) === String(friendIdToOpen),
      ),
    );

    if (existing) {
      setActive(existing);
      return existing;
    }

    setLoadingConversations(true);
    setError("");

    try {
      const { data } = await api.post(`/chats/conversations/${friendIdToOpen}`);
      const conversation = data.conversation;
      setConversations((current) => {
        if (
          current.some((item) => String(item._id) === String(conversation._id))
        ) {
          return current;
        }
        return [conversation, ...current];
      });
      setActive(conversation);
      return conversation;
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to open conversation.");
      return null;
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!friendId) return;
    openConversationForFriend(friendId);
  }, [friendId]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!active?._id) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      setError("");

      try {
        const { data } = await api.get(
          `/chats/conversations/${active._id}/messages`,
        );
        setMessages(data.messages || []);
      } catch (err) {
        setError(err?.response?.data?.message || "Unable to load messages.");
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [active?._id]);

  useEffect(() => {
    if (!socket || !active?._id) return undefined;

    socket.emit("conversation:join", { conversationId: active._id });

    const handler = (message) => {
      if (String(message.conversation) !== String(active._id)) return;
      setMessages((current) => [...current, message]);
    };

    socket.on("message:new", handler);

    return () => {
      socket.emit("conversation:leave", { conversationId: active._id });
      socket.off("message:new", handler);
    };
  }, [socket, active?._id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || !active?._id) return;

    try {
      const { data } = await api.post(
        `/chats/conversations/${active._id}/messages`,
        {
          text,
        },
      );
      setMessages((current) => [...current, data.message]);
      setText("");
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to send message.");
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-7.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[280px_1fr]">
      <aside className="border-r border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h1 className="text-xl font-bold">Messages</h1>
        </div>

        <div className="scrollbar-thin h-full overflow-y-auto">
          {loadingConversations ? (
            <div className="p-6 text-center text-slate-500">
              Loading conversations...
            </div>
          ) : conversations.length ? (
            conversations.map((conversation) => {
              const person = otherParticipant(conversation);
              const isActive = active?._id === conversation._id;
              return (
                <button
                  key={conversation._id}
                  onClick={() => setActive(conversation)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 ${
                    isActive ? "bg-brand-50 dark:bg-slate-800" : ""
                  }`}
                >
                  <Avatar src={person?.profile?.avatar} name={person?.name} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {person?.name || "Conversation"}
                    </p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                      {conversation.lastMessage?.text || "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-slate-500">
              No conversations yet. Select a friend to start chatting.
            </div>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col">
        {error ? (
          <div className="grid flex-1 place-items-center p-6 text-center text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : active ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
              <Avatar
                src={otherParticipant(active)?.profile?.avatar}
                name={otherParticipant(active)?.name}
              />
              <div>
                <h2 className="font-semibold">
                  {otherParticipant(active)?.name}
                </h2>
                <p className="text-xs text-slate-500">Active conversation</p>
              </div>
            </div>

            <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="p-6 text-center text-slate-500">
                  Loading messages...
                </div>
              ) : messages.length ? (
                messages.map((message) => {
                  const mine =
                    message.sender?._id === user._id ||
                    String(message.sender) === String(user._id);
                  return (
                    <div
                      key={message._id}
                      className={`flex ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                          mine
                            ? "bg-brand-600 text-white"
                            : "bg-slate-100 dark:bg-slate-800"
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-slate-500">
                  No messages yet. Send a message to start the conversation.
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={send}
              className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
            >
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write a message"
                className="flex-1 rounded-full bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-950"
              />
              <button className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white">
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center text-slate-500">
            Select a conversation or start a new chat from your friend list.
          </div>
        )}
      </section>
    </div>
  );
}
