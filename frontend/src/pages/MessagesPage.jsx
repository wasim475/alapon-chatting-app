import { Send } from "lucide-react";
import React, { useEffect, useState } from "react";
import Avatar from "../components/ui/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { api } from "../lib/api.js";

export default function MessagesPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    api.get("/chats/conversations").then(({ data }) => {
      setConversations(data.conversations);
      setActive(data.conversations[0] || null);
    });
  }, []);

  useEffect(() => {
    if (!active?._id) return;
    api
      .get(`/chats/conversations/${active._id}/messages`)
      .then(({ data }) => setMessages(data.messages));
  }, [active?._id]);

  useEffect(() => {
    if (!socket) return undefined;

    const handler = (message) => {
      if (message.conversation === active?._id) {
        setMessages((current) => [...current, message]);
      }
    };

    socket.on("message:new", handler);
    return () => socket.off("message:new", handler);
  }, [socket, active?._id]);

  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || !active?._id) return;

    const { data } = await api.post(`/chats/conversations/${active._id}/messages`, {
      text
    });
    setMessages((current) => [...current, data.message]);
    setText("");
  };

  const otherParticipant = (conversation) =>
    conversation?.participants?.find((participant) => participant._id !== user._id);

  return (
    <div className="grid h-[calc(100vh-7.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[280px_1fr]">
      <aside className="border-r border-slate-200 dark:border-slate-800">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h1 className="text-xl font-bold">Messages</h1>
        </div>
        <div className="scrollbar-thin h-full overflow-y-auto">
          {conversations.map((conversation) => {
            const person = otherParticipant(conversation);
            return (
              <button
                key={conversation._id}
                onClick={() => setActive(conversation)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  active?._id === conversation._id ? "bg-brand-50 dark:bg-slate-800" : ""
                }`}
              >
                <Avatar src={person?.profile?.avatar} name={person?.name} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{person?.name || "Conversation"}</p>
                  <p className="truncate text-sm text-slate-500">{conversation.lastMessage?.text || "No messages yet"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-col">
        {active ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
              <Avatar src={otherParticipant(active)?.profile?.avatar} name={otherParticipant(active)?.name} />
              <div>
                <h2 className="font-semibold">{otherParticipant(active)?.name}</h2>
                <p className="text-xs text-slate-500">Active conversation</p>
              </div>
            </div>

            <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((message) => {
                const mine = message.sender?._id === user._id || message.sender === user._id;
                return (
                  <div key={message._id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${mine ? "bg-brand-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>
                      {message.text}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={send} className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
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
            Start a conversation from a friend profile.
          </div>
        )}
      </section>
    </div>
  );
}
