"use client";

import { useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { streamLearning } from "@/frontend/lib/sse-client";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { AgentEvent, ResourceType } from "@/backend/types";

interface Turn {
  id: string;
  role: "user" | "assistant";
  text?: string;
  started: ResourceType[];
  done: boolean;
}

const RESOURCE_LABEL: Record<ResourceType, string> = {
  doc: "📄 文档",
  quiz: "❓ 题库",
  mindmap: "🧠 导图",
  video: "🎬 视频",
  code: "💻 代码",
  reading: "📚 阅读",
};

const SUGGESTIONS = [
  "我是零基础，想学数据结构与算法，备战期末考试",
  "我对排序算法不太懂，能帮我梳理一下吗？",
  "我学过数组链表，现在想深入二叉树和递归",
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const {
    profile,
    path,
    status,
    running,
    error,
    setProfile,
    setPath,
    setStatus,
    setRunning,
    setError,
    onResourceStart,
    onResourceDelta,
    upsertResource,
    resetResources,
  } = useLearningStore();

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    setInput("");
    setError(null);
    resetResources();
    setRunning(true);
    setStatus({ agent: "system", message: "多智能体闭环启动中…" });

    const userTurn: Turn = {
      id: `u-${nanoid()}`,
      role: "user",
      text: trimmed,
      started: [],
      done: true,
    };
    const assistantId = `a-${nanoid()}`;
    const assistantTurn: Turn = {
      id: assistantId,
      role: "assistant",
      started: [],
      done: false,
    };
    setTurns((t) => [...t, userTurn, assistantTurn]);

    await streamLearning(trimmed, {
      onEvent: (e: AgentEvent) => handleEvent(e, assistantId),
    });
    setRunning(false);
    setStatus(null);
  }

  function handleEvent(e: AgentEvent, assistantId: string) {
    switch (e.type) {
      case "status":
        setStatus({ agent: e.agent, message: e.message });
        break;
      case "profile":
        setProfile(e.profile);
        break;
      case "path":
        setPath(e.path);
        break;
      case "resource_start":
        onResourceStart({
          id: e.id,
          resType: e.resType,
          title: e.title,
          topic: e.topic,
        });
        setTurns((t) =>
          t.map((turn) =>
            turn.id === assistantId && !turn.started.includes(e.resType)
              ? { ...turn, started: [...turn.started, e.resType] }
              : turn,
          ),
        );
        break;
      case "resource_delta":
        onResourceDelta(e.id, e.text);
        break;
      case "resource":
        upsertResource(e.resource);
        break;
      case "error":
        setError(e.message);
        setRunning(false);
        setTurns((t) =>
          t.map((turn) => (turn.id === assistantId ? { ...turn, done: true } : turn)),
        );
        break;
      case "done":
        setTurns((t) =>
          t.map((turn) => (turn.id === assistantId ? { ...turn, done: true } : turn)),
        );
        useLearningStore.getState().saveRecord();
        break;
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 对话区 */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[54vh] min-h-[280px]">
        {turns.length === 0 && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <p className="text-slate-500">
              告诉我你的<strong>专业背景、学习目标与薄弱点</strong>，多智能体系统将为你构建画像、规划路径，并<strong>并行生成 6 种学习资源</strong>。
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-white">
                <span className="whitespace-pre-wrap">{turn.text}</span>
              </div>
            </div>
          ) : (
            <AssistantBubble key={turn.id} turn={turn} />
          ),
        )}
      </div>

      {/* 状态条 */}
      {(status || error) && (
        <div className="border-t border-slate-100 px-5 py-2 text-xs">
          {error ? (
            <span className="text-red-600">✕ {error}</span>
          ) : (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              {status?.message}
            </span>
          )}
        </div>
      )}

      {/* 结果入口 */}
      {(profile || path) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-2.5">
          {profile && (
            <Link
              href="/profile"
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
            >
              ✦ 画像已更新（{Object.keys(profile.knowledge_level).length} 个知识点）→ 查看
            </Link>
          )}
          {path && (
            <Link
              href="/learn"
              className="rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700 hover:bg-indigo-100"
            >
              ✦ 学习路径已生成（{path.steps.length} 步）→ 查看
            </Link>
          )}
        </div>
      )}

      {/* 输入区 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-slate-100 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：我想学二叉树，目标是面试…"
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={running || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "生成中…" : "发送"}
        </button>
      </form>
    </div>
  );
}

function AssistantBubble({ turn }: { turn: Turn }) {
  const running = !turn.done;
  const count = turn.started.length;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-slate-800">
        {running && count === 0 ? (
          <span className="inline-flex gap-1 text-slate-400">
            <Dot /> <Dot /> <Dot />
            <span className="ml-2 text-xs">多智能体协同启动中…</span>
          </span>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              多智能体正在为你协同生成 <strong>{count || 6}</strong> 种学习资源：
            </div>
            <div className="flex flex-wrap gap-1.5">
              {turn.started.map((t) => (
                <span
                  key={t}
                  className="animate-[pulse_1s_ease-in-out_1] rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                >
                  {RESOURCE_LABEL[t]}
                </span>
              ))}
              {running && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-slate-400 ring-1 ring-slate-200">
                  <Dot /> 生成中
                </span>
              )}
            </div>
            {turn.done && count > 0 && (
              <Link
                href="/learn"
                className="inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                ✓ 已生成 {count} 种资源 → 前往学习中心
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return (
    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
  );
}
