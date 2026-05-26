import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import React from "react";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/auth" replace />;
}
