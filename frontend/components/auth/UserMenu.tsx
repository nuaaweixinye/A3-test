"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export function UserMenu() {
  const router = useRouter();
  const user = useLearningStore((s) => s.user);
  const setUser = useLearningStore((s) => s.setUser);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
      >
        登录
      </a>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
      >
        <span className="text-base">👤</span>
        <span className="max-w-[80px] truncate">{user.username}</span>
        <span className="text-xs text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <a
            href="/profile"
            className="block px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            我的画像
          </a>
          <button
            type="button"
            onClick={logout}
            className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}
