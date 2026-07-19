"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-400">
          加载中...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useLearningStore((state) => state.setUser);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "register" && password !== confirm) {
      setError("两次密码不一致");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await readJsonResponse(response);

      if (!response.ok) {
        setError(data.error || "操作失败");
        return;
      }
      if (!data.user) {
        setError("登录响应缺少用户信息，请重试。");
        return;
      }

      setUser(data.user);
      await hydrateLearningState();

      const from = searchParams.get("from") || "/";
      router.push(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white">
            AI
          </div>
          <h1 className="text-xl font-bold text-slate-800">智学多智能体</h1>
          <p className="text-sm text-slate-400">个性化学习系统</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex gap-2 border-b border-slate-100">
            {(["login", "register"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item);
                  setError("");
                }}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  mode === item
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {item === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="用户名"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="密码（至少 6 位）"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {mode === "register" && (
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder="确认密码"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            )}

            {error && <p className="text-center text-xs text-rose-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

async function readJsonResponse(response: Response): Promise<{
  error?: string;
  user?: { id: string; username: string };
}> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `接口返回了非 JSON 内容（HTTP ${response.status}），请确认本地服务已重启且 API 路由正常。`,
    );
  }
}

async function hydrateLearningState() {
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
      if (latest.progress) useLearningStore.setState({ progress: latest.progress });
      if (latest.resources) {
        const cards: Record<string, (typeof latest.resources)[0]> = {};
        const order: string[] = [];
        for (const resource of latest.resources) {
          cards[resource.id] = { ...resource, done: true };
          order.push(resource.id);
        }
        useLearningStore.setState({
          resourceCards: cards,
          resourceOrder: order,
        });
      }
    }
  } catch {
    // 登录已经成功，画像/记录加载失败不阻断进入系统。
  }
}
