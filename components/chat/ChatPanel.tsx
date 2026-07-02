"use client";

import { useState } from "react";
import Link from "next/link";
import { nanoid } from "nanoid";
import { streamLearning } from "@/lib/sse-client";
import { useLearningStore } from "@/lib/store/useLearningStore";
import { DocView } from "@/components/resource/DocView";
import type { AgentEvent } from "@/lib/types";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "我是零基础，想学数据结构与算法，备战期末考试",
  "我对排序算法不太懂，能帮我梳理一下吗？",
  "我学过数组链表，现在想深入二叉树和递归",
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);

  const {
    profile,
    path,
    status,
    running,
    error,
    setProfile,
    setPath,
    addResource,
    appendDoc,
    setStatus,
    setRunning,
    setError,
    resetDoc,
  } = useLearningStore();

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;

    setInput("");
    setError(null);
    resetDoc();
    setRunning(true);
    setStatus({ agent: "system", message: "多智能体闭环启动中…" });

    const userMsg: Msg = { id: `u-${nanoid()}`, role: "user", content: trimmed };
    const assistantMsg: Msg = { id: `a-${nanoid()}`, role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, assistantMsg]);

    await streamLearning(trimmed, {
      onEvent: (e: AgentEvent) => handleEvent(e, assistantMsg.id),
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
      case "doc_delta":
        appendDoc(e.text);
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: msg.content + e.text } : msg,
          ),
        );
        break;
      case "resource":
        addResource(e.resource);
        break;
      case "error":
        setError(e.message);
        setRunning(false);
        break;
      case "done":
        break;
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* 对话区 */}
      <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[52vh] min-h-[280px]">
        {messages.length === 0 && (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center">
            <p className="text-slate-500">
              告诉我你的<strong>专业背景、学习目标与薄弱点</strong>，多智能体系统将为你构建画像、规划路径并生成讲解文档。
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

        {messages.map((m) => (
          <div
            key={m.id}
            className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
          >
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2.5 text-white"
                  : "max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-slate-800"
              }
            >
              {m.role === "assistant" && !m.content && running ? (
                <span className="inline-flex gap-1 text-slate-400">
                  <Dot /> <Dot /> <Dot />
                </span>
              ) : m.role === "assistant" ? (
                <DocView content={m.content} />
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
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

function Dot() {
  return (
    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
  );
}
