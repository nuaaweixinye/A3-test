"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/frontend/components/ui/Toast";
import { UserMenu } from "@/frontend/components/auth/UserMenu";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

const NAV_LINKS = [
  { href: "/", label: "生成" },
  { href: "/learn", label: "学习" },
  { href: "/profile", label: "画像" },
  { href: "/eval", label: "评估" },
  { href: "/tutor", label: "辅导" },
  { href: "/knowledge", label: "知识库" },
  { href: "/review", label: "复盘中心" },
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setUser = useLearningStore((state) => state.setUser);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then(async (data) => {
        if (!data.user) return;
        setUser(data.user);

        const state = useLearningStore.getState();

        if (!state.profile) {
          try {
            const profileRes = await fetch("/api/profile");
            const profileData = await profileRes.json();
            if (profileData.profile) {
              useLearningStore.setState({ profile: profileData.profile });
            }
          } catch {}
        }

        if (state.resourceOrder.length === 0) {
          try {
            const recordsRes = await fetch("/api/records");
            const recordsData = await recordsRes.json();
            if (recordsData.records?.length > 0) {
              const latest = recordsData.records[0];
              if (latest.path) useLearningStore.setState({ path: latest.path });
              if (latest.progress) useLearningStore.setState({ progress: latest.progress });
              if (latest.resources) {
                const cards: Record<string, typeof latest.resources[0]> = {};
                const order: string[] = [];
                for (const resource of latest.resources) {
                  cards[resource.id] = { ...resource, done: true };
                  order.push(resource.id);
                }
                useLearningStore.setState({ resourceCards: cards, resourceOrder: order });
              }
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, [setUser]);

  if (pathname === "/login") {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              AI
            </span>
            <span className="truncate">智学多智能体</span>
            <span className="hidden text-xs font-normal text-slate-400 md:inline">
              个性化学习工作台
            </span>
          </Link>

          <div className="no-scrollbar ml-auto flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 transition ${
                    active
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
          <div className="ml-1 shrink-0 border-l border-slate-200 pl-2">
            <UserMenu />
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:py-6">
        {children}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        LangGraph.js 多智能体协同 · 科大讯飞星火大模型 · 个性化学习闭环
      </footer>
    </ToastProvider>
  );
}
