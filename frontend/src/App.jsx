import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/layout/Layout.jsx";
import ProtectedRoute from "./components/routing/ProtectedRoute.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import FeedPage from "./pages/FeedPage.jsx";
import MessagesPage from "./pages/MessagesPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-200">
        Loading Alapon...
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" /> : <AuthPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<FeedPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/profile/:id" element={<ProfilePage />} />
        <Route path="/search" element={<SearchPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/" : "/auth"} />} />
    </Routes>
  );
}
