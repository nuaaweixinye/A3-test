import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "智学多智能体 · 个性化学习系统",
  description:
    "基于大模型的个性化资源生成与学习多智能体系统（第十五届中国软件杯 A3 赛题）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
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
              <NavLink href="/">对话</NavLink>
              <NavLink href="/profile">画像</NavLink>
              <NavLink href="/learn">学习中心</NavLink>
              <NavLink href="/tutor">辅导</NavLink>
              <NavLink href="/eval">评估</NavLink>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
          多智能体协同框架：LangGraph.js · 大模型：科大讯飞星火 ·
          架构参考 THU-MAIC/OpenMAIC (MIT)
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
