import type { Metadata } from "next";
import "./globals.css";
import { NavShell } from "@/frontend/components/auth/NavShell";

export const metadata: Metadata = {
  title: "智学多智能体 · 个性化学习系统",
  description: "基于大模型的个性化资源生成与学习多智能体系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900">
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}
