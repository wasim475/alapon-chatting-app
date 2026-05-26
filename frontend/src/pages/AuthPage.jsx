import React, { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login({ email: form.email, password: form.password });
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950 lg:grid-cols-2">
      <section className="mx-auto flex max-w-xl flex-col justify-center">
        <p className="text-lg font-semibold text-brand-600">Alapon</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 dark:text-white md:text-5xl">
          Connect, share, and chat in real time.
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
          A lightweight Facebook and Messenger style social platform built with the MERN stack.
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-md items-center">
        <form
          onSubmit={submit}
          className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {["login", "register"].map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => setMode(item)}
                className={`rounded-md px-4 py-2 text-sm font-semibold capitalize ${
                  mode === item ? "bg-white text-brand-700 shadow-sm dark:bg-slate-950" : ""
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {mode === "register" && (
            <label className="mt-5 block text-sm font-medium">
              Full Name
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
                required
              />
            </label>
          )}

          <label className="mt-5 block text-sm font-medium">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
              required
            />
          </label>

          <label className="mt-5 block text-sm font-medium">
            Password
            <input
              type="password"
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-950"
              required
            />
          </label>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-3 font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </section>
    </div>
  );
}
