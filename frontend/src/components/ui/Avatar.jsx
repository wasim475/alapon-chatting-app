import React from "react";
export default function Avatar({ src, name, size = "md" }) {
  const sizes = {
    sm: "h-9 w-9 text-sm",
    md: "h-11 w-11",
    lg: "h-24 w-24 text-2xl"
  };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover ring-2 ring-white dark:ring-slate-900`}
      />
    );
  }

  return (
    <div
      className={`${sizes[size]} grid place-items-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-700 dark:text-white`}
    >
      {name?.[0]?.toUpperCase() || "A"}
    </div>
  );
}
