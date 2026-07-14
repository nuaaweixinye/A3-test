"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400">加载中…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useLearningStore((s) => s.setUser);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirm) {
      setError("两次密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "操作失败");
        setLoading(false);
        return;
      }

      setUser(data.user);

      try {
        const [profileRes, recordsRes] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/records"),
        ]);
        const profileData = await profileRes.json();
        const recordsData = await recordsRes.json();

        if (profileData.profile) {
          useLearningStore.getState().setProfile(profileData.profile);
        }
        if (recordsData.records?.length > 0) {
          const latest = recordsData.records[0];
          if (latest.path) useLearningStore.getState().setPath(latest.path);
          if (latest.progress)
            useLearningStore.setState({ progress: latest.progress });
          if (latest.resources) {
            const cards: Record<string, typeof latest.resources[0]> = {};
            const order: string[] = [];
            for (const r of latest.resources) {
              cards[r.id] = { ...r, done: true };
              order.push(r.id);
            }
            useLearningStore.setState({
              resourceCards: cards,
              resourceOrder: order,
            });
          }
        }
      } catch {
        // Profile/record loading is best-effort
      }

      const from = searchParams.get("from") || "/";
      router.push(from);
    } catch (err) {
      console.error("Auth error:", err);
      setError(
        err instanceof Error
          ? `网络错误：${err.message}`
          : "请求失败，请检查网络后重试",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl">
            🎓
          </div>
          <h1 className="text-xl font-bold text-slate-800">智学多智能体</h1>
          <p className="text-sm text-slate-400">个性化学习系统</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex gap-2 border-b border-slate-100">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  mode === m
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {m === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 6 位）"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {mode === "register" && (
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="确认密码"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            )}

            {error && (
              <p className="text-center text-xs text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "请稍候…"
                : mode === "login"
                  ? "登 录"
                  : "注 册"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
