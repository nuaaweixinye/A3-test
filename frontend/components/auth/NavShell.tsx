"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { UserMenu } from "./UserMenu";

const NAV_LINKS = [
  { href: "/", label: "对话" },
  { href: "/profile", label: "画像" },
  { href: "/learn", label: "学习中心" },
  { href: "/tutor", label: "辅导" },
  { href: "/eval", label: "评估" },
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setUser = useLearningStore((s) => s.setUser);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, [setUser]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600" />
            <span>智学多智能体</span>
            <span className="hidden text-xs font-normal text-slate-400 sm:inline">
              A3 · 数据结构与算法
            </span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    active
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="ml-2 border-l border-slate-200 pl-2">
              <UserMenu />
            </div>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        多智能体协同框架：LangGraph.js · 大模型：科大讯飞星火 · 架构参考
        THU-MAIC/OpenMAIC (MIT)
      </footer>
    </>
  );
}
