"use client";

import { usePathname } from "next/navigation";

export function BackLink() {
  const pathname = usePathname();
  if (!pathname || pathname === "/") return null;

  return (
    <button
      type="button"
      className="back-link"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }}
      aria-label="Go back"
    >
      ← Back
    </button>
  );
}
