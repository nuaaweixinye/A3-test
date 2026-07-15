"use client";

import { useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { startLearning } from "@/frontend/lib/stream-manager";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { ResourceType } from "@/backend/types";

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
  "我是零基础，想学Python编程，目标是能独立开发小项目",
  "我想系统复习高等数学中的微积分，备战考研",
  "我对计算机网络不太懂，能帮我梳理一下TCP/IP吗？",
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const running = useLearningStore((s) => s.running);
  const status = useLearningStore((s) => s.status);
  const error = useLearningStore((s) => s.error);
  const profile = useLearningStore((s) => s.profile);
  const path = useLearningStore((s) => s.path);
  const resourceOrder = useLearningStore((s) => s.resourceOrder);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    setInput("");

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

    await startLearning(trimmed);

    setTurns((t) =>
      t.map((turn) =>
        turn.id === assistantId ? { ...turn, done: true } : turn,
      ),
    );
  }

  const startedTypes = new Set<ResourceType>();
  for (const id of resourceOrder) {
    const card = useLearningStore.getState().resourceCards[id];
    if (card) startedTypes.add(card.resType);
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[54vh] min-h-[280px]">
        {turns.length === 0 && !running && (
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

        {turns.length === 0 && running && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <span className="inline-flex gap-1 text-slate-400">
              <Dot /> <Dot /> <Dot />
              <span className="ml-2 text-xs">多智能体协同生成中…切换页面不影响生成进度</span>
            </span>
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
            <AssistantBubble
              key={turn.id}
              turn={turn}
              startedTypes={startedTypes}
            />
          ),
        )}
      </div>

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
          placeholder="例如：我想学Python编程，目标是能独立开发…"
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

function AssistantBubble({
  turn,
  startedTypes,
}: {
  turn: Turn;
  startedTypes: Set<ResourceType>;
}) {
  const running = !turn.done;
  const types = Array.from(startedTypes);

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-slate-800">
        {running && types.length === 0 ? (
          <span className="inline-flex gap-1 text-slate-400">
            <Dot /> <Dot /> <Dot />
            <span className="ml-2 text-xs">多智能体协同启动中…</span>
          </span>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              多智能体正在为你协同生成 <strong>{types.length || 6}</strong> 种学习资源：
            </div>
            <div className="flex flex-wrap gap-1.5">
              {types.map((t) => (
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
            {turn.done && types.length > 0 && (
              <Link
                href="/learn"
                className="inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                ✓ 已生成 {types.length} 种资源 → 前往学习记录
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
