"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export function UserMenu() {
  const router = useRouter();
  const user = useLearningStore((state) => state.user);
  const setUser = useLearningStore((state) => state.setUser);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    useLearningStore.setState({
      profile: null,
      path: null,
      resourceOrder: [],
      resourceCards: {},
      progress: {},
      weakTopics: [],
    });
    router.push("/login");
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
      >
        登录
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-24 truncate">{user.username}</span>
        <span className="text-xs text-slate-400">展开</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            我的画像
          </Link>
          <Link
            href="/review"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            复盘中心
          </Link>
          <button
            type="button"
            onClick={logout}
            className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
