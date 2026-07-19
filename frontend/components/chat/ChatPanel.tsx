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
  done: boolean;
}

const RESOURCE_LABEL: Record<ResourceType, string> = {
  design: "设计/PPT",
  doc: "文档",
  quiz: "题库",
  mindmap: "导图",
  video: "视频",
  code: "代码",
  reading: "阅读",
};

const SUGGESTIONS = [
  "我是零基础，想学 Python 编程，目标是独立开发一个小项目",
  "我想系统复习高等数学里的微积分，准备考研",
  "我对计算机网络不太懂，帮我梳理 TCP/IP 的学习路径",
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const running = useLearningStore((state) => state.running);
  const status = useLearningStore((state) => state.status);
  const error = useLearningStore((state) => state.error);
  const profile = useLearningStore((state) => state.profile);
  const path = useLearningStore((state) => state.path);
  const resourceOrder = useLearningStore((state) => state.resourceOrder);
  const resourceCards = useLearningStore((state) => state.resourceCards);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    setInput("");
    const assistantId = `a-${nanoid()}`;
    setTurns((items) => [
      ...items,
      { id: `u-${nanoid()}`, role: "user", text: trimmed, done: true },
      { id: assistantId, role: "assistant", done: false },
    ]);

    await startLearning(trimmed);

    setTurns((items) =>
      items.map((turn) => (turn.id === assistantId ? { ...turn, done: true } : turn)),
    );
  }

  const startedTypes = new Set<ResourceType>();
  for (const id of resourceOrder) {
    const card = resourceCards[id];
    if (card) startedTypes.add(card.resType);
  }

  return (
    <div className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">学习需求输入</h2>
            <p className="mt-1 text-xs text-slate-400">
              说明专业背景、学习目标、历史基础和薄弱点，系统会自动生成完整学习闭环。
            </p>
          </div>
          {running && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              生成中
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        {turns.length === 0 && !running && <EmptyState onPick={send} />}

        {turns.length === 0 && running && (
          <div className="flex h-full min-h-[320px] items-center justify-center">
            <LoadingText text="多智能体协同生成中，切换页面不影响进度" />
          </div>
        )}

        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex justify-end">
              <div className="max-w-[82%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm leading-6 text-white">
                {turn.text}
              </div>
            </div>
          ) : (
            <AssistantBubble key={turn.id} done={turn.done} startedTypes={startedTypes} />
          ),
        )}
      </div>

      {(status || error) && (
        <div className="border-t border-slate-100 px-5 py-2 text-xs">
          {error ? (
            <span className="text-rose-600">{error}</span>
          ) : (
            <span className="inline-flex items-center gap-2 text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
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
              className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              画像已更新 · {Object.keys(profile.knowledge_level).length} 个知识点
            </Link>
          )}
          {path && (
            <Link
              href="/learn"
              className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              学习路径已生成 · {path.steps.length} 步
            </Link>
          )}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex gap-2 border-t border-slate-100 bg-slate-50/70 p-3"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="例如：我是计算机专业大二学生，数据结构里的图算法比较薄弱，想用两小时补齐..."
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="submit"
          disabled={running || !input.trim()}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? "生成中" : "发送"}
        </button>
      </form>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex h-full min-h-[360px] flex-col justify-center">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-base font-semibold text-slate-800">今天想学什么？</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          输入你的基础、目标、时间安排和薄弱点。系统会自动完成画像、路径规划和多模态资源生成。
        </p>
      </div>
      <div className="mx-auto mt-5 grid w-full max-w-3xl gap-2 sm:grid-cols-3">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPick(item)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm leading-5 text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantBubble({
  done,
  startedTypes,
}: {
  done: boolean;
  startedTypes: Set<ResourceType>;
}) {
  const types = Array.from(startedTypes);

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-slate-50 px-4 py-3 text-slate-800 ring-1 ring-slate-100">
        {!done && types.length === 0 ? (
          <LoadingText text="正在启动画像和规划 Agent" />
        ) : (
          <div className="space-y-3">
            <p className="text-sm">
              已启动 <strong>{types.length || 7}</strong> 类学习资源生成。
            </p>
            <div className="flex flex-wrap gap-1.5">
              {types.map((type) => (
                <span
                  key={type}
                  className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 ring-1 ring-slate-200"
                >
                  {RESOURCE_LABEL[type]}
                </span>
              ))}
              {!done && (
                <span className="rounded-full bg-white px-2.5 py-1 text-xs text-blue-600 ring-1 ring-blue-100">
                  持续生成中
                </span>
              )}
            </div>
            {done && types.length > 0 && (
              <Link
                href="/learn"
                className="inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                前往学习记录
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingText({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
      <span>{text}</span>
    </span>
  );
}
