import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false));
  }, []);

  const login = async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    setUser(data.user);
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setUser(data.user);
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, setUser, booting, login, register, logout }),
    [user, booting]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
