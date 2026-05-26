import { Camera, MapPin } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Avatar from "../components/ui/Avatar.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";

export default function ProfilePage() {
  const { id } = useParams();
  const { user: authUser, setUser } = useAuth();
  const [user, setProfileUser] = useState(null);
  const [bio, setBio] = useState("");

  useEffect(() => {
    api.get(`/users/${id}`).then(({ data }) => {
      setProfileUser(data.user);
      setBio(data.user.profile?.bio || "");
    });
  }, [id]);

  const isMe = authUser._id === id;

  const saveBio = async () => {
    const { data } = await api.patch("/users/me/profile", { bio });
    setProfileUser(data.user);
    setUser(data.user);
  };

  const upload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);
    const { data } = await api.post(`/users/me/upload/${type}`, formData);
    setProfileUser(data.user);
    setUser(data.user);
  };

  if (!user) {
    return <p className="rounded-lg bg-white p-6 text-center dark:bg-slate-900">Loading profile...</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="relative h-56 bg-slate-200 dark:bg-slate-800">
        {user.profile?.coverPhoto && (
          <img src={user.profile.coverPhoto} alt="" className="h-full w-full object-cover" />
        )}
        {isMe && (
          <label className="absolute bottom-4 right-4 flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold shadow dark:bg-slate-950">
            <Camera size={18} />
            Cover
            <input type="file" className="hidden" onChange={(event) => upload(event, "cover")} />
          </label>
        )}
      </div>

      <div className="px-5 pb-6">
        <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="relative">
            <Avatar src={user.profile?.avatar} name={user.name} size="lg" />
            {isMe && (
              <label className="absolute bottom-1 right-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-brand-600 text-white">
                <Camera size={17} />
                <input type="file" className="hidden" onChange={(event) => upload(event, "avatar")} />
              </label>
            )}
          </div>
          <div className="pb-2">
            <h1 className="text-3xl font-black">{user.name}</h1>
            <p className="text-sm text-slate-500">{user.friends?.length || 0} friends</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_2fr]">
          <section className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <h2 className="font-bold">Intro</h2>
            {isMe ? (
              <>
                <textarea
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="mt-3 min-h-28 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 outline-none focus:border-brand-500 dark:border-slate-800 dark:bg-slate-900"
                  placeholder="Write a short bio"
                />
                <button onClick={saveBio} className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white">
                  Save intro
                </button>
              </>
            ) : (
              <p className="mt-3 text-slate-600 dark:text-slate-300">{user.profile?.bio || "No bio yet."}</p>
            )}
            {user.profile?.location && (
              <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <MapPin size={17} />
                {user.profile.location}
              </p>
            )}
          </section>
          <section className="rounded-lg bg-slate-50 p-4 dark:bg-slate-950">
            <h2 className="font-bold">Timeline</h2>
            <p className="mt-3 text-sm text-slate-500">User-specific posts will appear here in the next phase.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
