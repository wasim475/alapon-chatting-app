import { UserPlus } from "lucide-react";
import React, { useState } from "react";
import Avatar from "../components/ui/Avatar.jsx";
import { api } from "../lib/api.js";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState([]);

  const search = async (event) => {
    event.preventDefault();
    const { data } = await api.get("/users/search", { params: { q } });
    setUsers(data.users);
  };

  const sendRequest = async (id) => {
    await api.post(`/friends/request/${id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name or email"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-500 dark:border-slate-800 dark:bg-slate-900"
        />
        <button className="rounded-lg bg-brand-600 px-5 font-bold text-white">Search</button>
      </form>

      <div className="mt-5 space-y-3">
        {users.map((person) => (
          <div key={person._id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Avatar src={person.profile?.avatar} name={person.name} />
              <div>
                <h2 className="font-semibold">{person.name}</h2>
                <p className="text-sm text-slate-500">{person.email}</p>
              </div>
            </div>
            <button onClick={() => sendRequest(person._id)} className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-100">
              <UserPlus size={18} />
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
