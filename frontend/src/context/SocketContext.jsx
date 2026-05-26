import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user?._id) return undefined;

    const nextSocket = io(
      import.meta.env.VITE_SOCKET_URL ||
        "https://alapon-chatting-app.onrender.com",
      {
        withCredentials: true,
      },
    );

    const joinUser = () => {
      nextSocket.emit("user:join", user._id);
    };

    nextSocket.on("connect", joinUser);
    nextSocket.on("reconnect", joinUser);
    nextSocket.on("connect_error", (error) => {
      console.error("Socket connect error:", error);
    });

    if (nextSocket.connected) {
      joinUser();
    }

    setSocket(nextSocket);

    return () => {
      nextSocket.off("connect", joinUser);
      nextSocket.off("reconnect", joinUser);
      nextSocket.off("connect_error");
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [user?._id]);

  const value = useMemo(() => ({ socket }), [socket]);
  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
