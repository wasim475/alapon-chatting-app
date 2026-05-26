import { Bell, Home, MessageCircle, Moon, Search, Sun, UserRound } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import React from "react";

const navItems = [
  { to: "/", label: "Feed", icon: Home },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/search", label: "Search", icon: Search }
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <NavLink to="/" className="text-2xl font-black text-brand-600">
            Alapon
          </NavLink>
          <div className="hidden w-full max-w-md items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-500 dark:bg-slate-900 md:flex">
            <Search size={18} />
            Search friends, posts, and conversations
          </div>
          <div className="flex items-center gap-2">
            <button className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-900">
              <Bell size={19} />
            </button>
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

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-2">
            <NavLink
              to={`/profile/${user._id}`}
              className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <UserRound size={20} />
              {user.name}
            </NavLink>
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
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
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-semibold">Contacts</h2>
            <div className="mt-4 space-y-3">
              {user.friends?.length ? (
                user.friends.slice(0, 8).map((friend) => (
                  <div key={friend} className="flex items-center gap-3 text-sm">
                    <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700" />
                    Friend
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Search people to start building your network.</p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
