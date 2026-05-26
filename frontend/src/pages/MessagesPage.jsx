import {
  Send,
  Phone,
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  X,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { api } from "../lib/api.js";
import { playIncomingMessageSound } from "../lib/audio.js";

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
  const [typingParticipant, setTypingParticipant] = useState("");
  const [callState, setCallState] = useState("idle");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callError, setCallError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const endRef = useRef(null);
  const activeRef = useRef(active);
  const peerConnectionRef = useRef(null);
  const typingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  const otherParticipant = (conversation) =>
    conversation?.participants?.find(
      (participant) => String(participant._id) !== String(user._id),
    );

  const cleanupMediaPreview = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
  };

  const clearMedia = () => {
    cleanupMediaPreview();
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType("");
    setRecordingError("");
  };

  const handleMediaChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("audio/")
      ? "audio"
      : "";

    if (!type) return;

    cleanupMediaPreview();
    setMediaFile(file);
    setMediaType(type);
    setMediaPreview(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setRecordingError("Audio recording is not supported in this browser.");
      return;
    }

    setRecordingError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const recordedChunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        const file = new File([blob], "recording.webm", { type: "audio/webm" });
        cleanupMediaPreview();
        setMediaFile(file);
        setMediaType("audio");
        setMediaPreview(URL.createObjectURL(blob));
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setRecordingError("Unable to access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const dedupeConversations = (conversationList) => {
    const seen = new Set();
    return conversationList.filter((conversation) => {
      const other = otherParticipant(conversation);
      const otherId = String(other?._id);
      if (!otherId || seen.has(otherId)) return false;
      seen.add(otherId);
      return true;
    });
  };

  const loadConversations = async () => {
    setLoadingConversations(true);
    setError("");

    try {
      const { data } = await api.get("/chats/conversations");
      const conversations = dedupeConversations(data.conversations || []);
      setConversations(conversations);
      if (!friendId) {
        setActive(conversations?.[0] || null);
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

  const addMessage = (message) => {
    if (!message?._id) return;
    setMessages((current) => {
      if (current.some((item) => String(item._id) === String(message._id))) {
        return current;
      }
      return [...current, message];
    });
  };

  const updateConversationMeta = (conversationId, update) => {
    setConversations((current) =>
      current.map((conversation) =>
        String(conversation._id) !== String(conversationId)
          ? conversation
          : {
              ...conversation,
              ...update,
            },
      ),
    );
  };

  const markConversationRead = async (conversationId) => {
    if (!conversationId) return;
    try {
      await api.patch(`/chats/conversations/${conversationId}/read`);
      updateConversationMeta(conversationId, { unreadCount: 0 });
    } catch {
      // ignore errors while marking read
    }
  };

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
      markConversationRead(active._id);
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to load messages.");
    } finally {
      setLoadingMessages(false);
    }
  };

  const stopTyping = () => {
    if (!socket || !activeRef.current || !typingRef.current) return;
    const receiver = otherParticipant(activeRef.current);
    if (!receiver) return;
    socket.emit("typing:stop", {
      conversationId: activeRef.current._id,
      receiverId: receiver._id,
      userId: user._id,
    });
    typingRef.current = false;
    clearTimeout(typingTimeoutRef.current);
  };

  const handleTyping = () => {
    if (!socket || !activeRef.current) return;
    const receiver = otherParticipant(activeRef.current);
    if (!receiver) return;

    if (!typingRef.current) {
      socket.emit("typing:start", {
        conversationId: activeRef.current._id,
        receiverId: receiver._id,
        userId: user._id,
        userName: user.name,
      });
      typingRef.current = true;
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1200);
  };

  const createPeerConnection = (remoteUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate || !socket || !activeRef.current) return;
      const receiver = otherParticipant(activeRef.current);
      if (!receiver) return;
      socket.emit("call:candidate", {
        receiverId: receiver._id,
        conversationId: activeRef.current._id,
        candidate: event.candidate,
      });
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected" ||
        pc.connectionState === "closed"
      ) {
        endCall(false);
      }
    };

    return pc;
  };

  const endCall = (notify = true) => {
    if (notify && socket && activeRef.current) {
      const receiver = otherParticipant(activeRef.current);
      if (receiver) {
        socket.emit("call:hangup", {
          receiverId: receiver._id,
          conversationId: activeRef.current._id,
        });
      }
    }

    setCallState("idle");
    setIncomingCall(null);
    setCallError("");

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    setIsMuted(false);
    setCameraOn(true);
  };

  const callUser = async (useVideo) => {
    if (!socket || !activeRef.current) return;
    const receiver = otherParticipant(activeRef.current);
    if (!receiver) return;

    setCallState("calling");
    setCallError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: useVideo,
      });

      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(receiver._id);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:offer", {
        receiverId: receiver._id,
        conversationId: activeRef.current._id,
        offer,
        isVideo: useVideo,
        callerId: user._id,
        callerName: user.name,
      });
    } catch (err) {
      setCallError("Unable to initiate the call.");
      endCall(false);
    }
  };

  const acceptIncomingCall = async () => {
    if (!socket || !incomingCall) return;
    setCallState("inCall");
    setCallError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.isVideo,
      });

      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = createPeerConnection(incomingCall.callerId);
      peerConnectionRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(incomingCall.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", {
        receiverId: incomingCall.callerId,
        conversationId: incomingCall.conversationId,
        answer,
      });
      setIncomingCall(null);
    } catch (err) {
      setCallError("Unable to answer the call.");
      endCall(false);
    }
  };

  const rejectIncomingCall = () => {
    if (socket && incomingCall) {
      socket.emit("call:reject", {
        receiverId: incomingCall.callerId,
        conversationId: incomingCall.conversationId,
      });
    }
    setIncomingCall(null);
    setCallState("idle");
  };

  const toggleMute = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMuted((current) => !current);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCameraOn((current) => !current);
  };

  const updateText = (value) => {
    setText(value);
    handleTyping();
  };

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!friendId) return;
    openConversationForFriend(friendId);
  }, [friendId]);

  useEffect(() => {
    loadMessages();
  }, [active?._id]);

  useEffect(() => {
    if (!socket || !active?._id) return undefined;
    socket.emit("conversation:join", { conversationId: active._id });

    return () => {
      socket.emit("conversation:leave", { conversationId: active._id });
    };
  }, [socket, active?._id]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleMessage = (message) => {
      if (!message?._id) return;
      const conversationId = String(message.conversation || message.conversation?._id);
      const isMine =
        String(message.sender?._id || message.sender) === String(user._id);

      if (activeRef.current && String(activeRef.current._id) === conversationId) {
        addMessage(message);
        updateConversationMeta(conversationId, {
          lastMessage: message,
          lastMessageAt: message.createdAt,
        });
        if (!isMine) {
          playIncomingMessageSound();
          markConversationRead(conversationId);
        }
        return;
      }

      updateConversationMeta(conversationId, {
        unreadCount: (activeRef.current && String(activeRef.current._id) === conversationId
          ? 0
          : (conversations.find((conv) => String(conv._id) === conversationId)?.unreadCount || 0) + (isMine ? 0 : 1)),
        lastMessage: message,
        lastMessageAt: message.createdAt,
      });

      if (!isMine) {
        playIncomingMessageSound();
      }
    };

    const handleTypingStart = ({ conversationId, userId, userName }) => {
      if (
        !activeRef.current ||
        String(conversationId) !== String(activeRef.current._id) ||
        String(userId) === String(user._id)
      ) {
        return;
      }
      setTypingParticipant(userName || "Typing...");
    };

    const handleTypingStop = ({ conversationId, userId }) => {
      if (
        !activeRef.current ||
        String(conversationId) !== String(activeRef.current._id) ||
        String(userId) === String(user._id)
      ) {
        return;
      }
      setTypingParticipant("");
    };

    const handleCallIncoming = ({ conversationId, offer, isVideo, callerId, callerName }) => {
      if (!conversationId || !offer || !callerId) return;
      setIncomingCall({ conversationId, offer, isVideo, callerId, callerName });
      setCallState("ringing");
    };

    const handleCallAnswer = async ({ conversationId, answer }) => {
      if (!peerConnectionRef.current || !answer) return;
      try {
        await peerConnectionRef.current.setRemoteDescription(answer);
        setCallState("inCall");
      } catch {
        setCallError("Failed to receive call answer.");
        endCall(false);
      }
    };

    const handleCallCandidate = async ({ candidate }) => {
      if (!peerConnectionRef.current || !candidate) return;
      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch {
        // ignore invalid candidate
      }
    };

    const handleCallEnded = () => {
      endCall(false);
    };

    const handleCallRejected = () => {
      setCallError("Call rejected.");
      endCall(false);
    };

    socket.on("message:new", handleMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
    socket.on("call:incoming", handleCallIncoming);
    socket.on("call:answer", handleCallAnswer);
    socket.on("call:candidate", handleCallCandidate);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:rejected", handleCallRejected);

    return () => {
      socket.off("message:new", handleMessage);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
      socket.off("call:incoming", handleCallIncoming);
      socket.off("call:answer", handleCallAnswer);
      socket.off("call:candidate", handleCallCandidate);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:rejected", handleCallRejected);
    };
  }, [socket, user._id, conversations]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (event) => {
    event.preventDefault();
    if ((!text.trim() && !mediaFile) || !active?._id) return;

    stopTyping();
    setMediaUploading(true);
    setError("");

    try {
      const formData = new FormData();
      if (text.trim()) formData.append("text", text.trim());
      if (mediaFile) formData.append("media", mediaFile);

      const { data } = await api.post(
        `/chats/conversations/${active._id}/messages`,
        formData,
      );

      addMessage(data.message);
      updateConversationMeta(active._id, {
        lastMessage: data.message,
        lastMessageAt: data.message.createdAt,
      });
      setText("");
      clearMedia();
    } catch (err) {
      setError(err?.response?.data?.message || "Unable to send message.");
    } finally {
      setMediaUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopTyping();
      endCall(false);
      clearTimeout(typingTimeoutRef.current);
      stopRecording();
      clearMedia();
    };
  }, []);

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
                  {conversation.unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-brand-600 px-2 py-1 text-[11px] font-semibold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
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
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar
                  src={otherParticipant(active)?.profile?.avatar}
                  name={otherParticipant(active)?.name}
                />
                <div>
                  <h2 className="font-semibold">
                    {otherParticipant(active)?.name}
                  </h2>
                  <p className="text-xs text-slate-500">Active conversation</p>
                  {typingParticipant && (
                    <p className="mt-1 text-xs text-brand-600">
                      {typingParticipant} is typing...
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => callUser(false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Phone size={16} /> Audio
                </button>
                <button
                  type="button"
                  onClick={() => callUser(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  <Video size={16} /> Video
                </button>
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
                        {message.text && (
                          <p className="mb-2 whitespace-pre-wrap">
                            {message.text}
                          </p>
                        )}
                        {message.image?.url && (
                          <img
                            src={message.image.url}
                            alt="Message attachment"
                            className="mb-2 max-h-80 w-full rounded-xl object-cover"
                          />
                        )}
                        {message.audio?.url && (
                          <audio
                            controls
                            src={message.audio.url}
                            className="w-full"
                          />
                        )}
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

            <div className="border-t border-slate-200 px-4 pt-4 pb-2 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => audioInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Audio
                </button>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm ${
                    isRecording
                      ? "bg-rose-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {isRecording ? "Stop" : "Record"}
                </button>
                {mediaFile && (
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Clear
                  </button>
                )}
              </div>

              {recordingError && (
                <p className="mt-3 text-sm text-rose-500">{recordingError}</p>
              )}

              {mediaPreview && mediaType === "image" && (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                  <img
                    src={mediaPreview}
                    alt="Image preview"
                    className="h-48 w-full object-contain"
                  />
                </div>
              )}

              {mediaPreview && mediaType === "audio" && (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <audio controls src={mediaPreview} className="w-full" />
                </div>
              )}
            </div>

            <form
              onSubmit={send}
              className="flex gap-2 border-t border-slate-200 p-4 dark:border-slate-800"
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMediaChange}
              />
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleMediaChange}
              />
              <input
                value={text}
                onChange={(event) => updateText(event.target.value)}
                placeholder="Write a message"
                className="flex-1 rounded-full bg-slate-100 px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-950"
              />
              <button
                type="submit"
                disabled={mediaUploading}
                className="grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mediaUploading ? "…" : <Send size={18} />}
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center p-6 text-center text-slate-500">
            Select a conversation or start a new chat from your friend list.
          </div>
        )}
      </section>

      {(callState !== "idle" || incomingCall) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-slate-400">
                  {callState === "ringing" ? "Incoming call" : "Call in progress"}
                </p>
                <p className="text-lg font-semibold">
                  {incomingCall ? incomingCall.callerName : otherParticipant(active)?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => endCall(true)}
                className="grid h-10 w-10 place-items-center rounded-full bg-slate-800 text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4 p-4 sm:grid-cols-[1fr_240px]">
              <div className="rounded-3xl bg-slate-950 p-3">
                <div className="relative overflow-hidden rounded-3xl bg-black">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-72 w-full bg-slate-900 object-cover"
                  />
                  {!remoteStream && (
                    <div className="absolute inset-0 grid place-items-center text-slate-500">
                      No remote video yet
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 rounded-3xl bg-slate-950 p-4">
                <div className="relative overflow-hidden rounded-3xl bg-slate-800">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-48 w-full bg-slate-900 object-cover"
                  />
                  {!localStream && (
                    <div className="absolute inset-0 grid place-items-center text-slate-500">
                      Local preview unavailable
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  >
                    {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                    {isMuted ? "Unmute" : "Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  >
                    {cameraOn ? <VideoOff size={16} /> : <Video size={16} />}
                    {cameraOn ? "Camera Off" : "Camera On"}
                  </button>
                  <button
                    type="button"
                    onClick={() => endCall(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-2 text-sm text-white"
                  >
                    <PhoneOff size={16} /> End Call
                  </button>
                </div>
                {callError && (
                  <p className="rounded-2xl bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                    {callError}
                  </p>
                )}
                {callState === "ringing" && incomingCall && (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-400">
                      {incomingCall.callerName} is calling.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={acceptIncomingCall}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                      >
                        Answer
                      </button>
                      <button
                        type="button"
                        onClick={rejectIncomingCall}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
                {callState === "calling" && !incomingCall && (
                  <div className="rounded-3xl bg-slate-900 p-4 text-center text-slate-300">
                    Calling {otherParticipant(active)?.name}...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
