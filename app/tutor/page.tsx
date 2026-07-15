"use client";

import { useState, useEffect } from "react";
import { nanoid } from "nanoid";
import { streamTextSse } from "@/frontend/lib/sse-client";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { DocView } from "@/frontend/components/resource/DocView";
import { SpeakButton } from "@/frontend/components/resource/SpeakButton";
import type { TutorTurn } from "@/backend/types";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConvSummary {
  id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

const SUGGESTIONS = [
  "二分查找在什么情况下不能使用？",
  "快速排序为什么最坏是 O(n²)？怎么优化？",
  "递归和迭代分别适合什么场景？",
];

export default function TutorPage() {
  const profile = useLearningStore((s) => s.profile);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshConversations() {
    try {
      const res = await fetch("/api/tutor/conversations");
      const data = await res.json();
      setConversations((data.conversations as ConvSummary[]) || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tutor/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setConversations((data.conversations as ConvSummary[]) || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadConversation(id: string) {
    if (running) return;
    try {
      const res = await fetch(`/api/tutor/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const conv = data.conversation;
      if (!conv) return;
      setSelectedId(id);
      setMessages(
        (conv.messages as Array<{ id: string; role: string; content: string }>).map(
          (m) => ({
            id: m.id,
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          }),
        ),
      );
      setError(null);
    } catch {
    }
  }

  function newChat() {
    setSelectedId(null);
    setMessages([]);
    setError(null);
    setInput("");
  }

  async function saveConversation(question: string, answer: string) {
    try {
      await fetch("/api/tutor/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: question.slice(0, 30),
          messages: [
            { role: "user", content: question },
            { role: "assistant", content: answer },
          ],
        }),
      });
      await refreshConversations();
    } catch {
    }
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || running) return;
    setInput("");
    setError(null);

    const userMsg: Msg = { id: `u-${nanoid()}`, role: "user", content: q };
    const aId = `a-${nanoid()}`;
    const aMsg: Msg = { id: aId, role: "assistant", content: "" };
    const history: TutorTurn[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((m) => [...m, userMsg, aMsg]);
    setRunning(true);

    let answer = "";
    await streamTextSse(
      "/api/tutor",
      { message: q, history, profile },
      {
        onDelta: (t) => {
          answer += t;
          setMessages((m) =>
            m.map((x) => (x.id === aId ? { ...x, content: x.content + t } : x)),
          );
        },
        onError: (e) => {
          setError(e.message);
          setRunning(false);
        },
        onDone: () => {
          setRunning(false);
          void saveConversation(q, answer);
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">智能辅导</h1>
          <p className="text-sm text-slate-500">
            基于知识库的多轮答疑 · 结合画像个性化 · 可朗读
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          {profile ? `当前画像：${profile.cognitive_style} · ${profile.learning_pace}` : "未构建画像"}
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit space-y-2">
          <button
            type="button"
            onClick={newChat}
            className="w-full rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            + 新建对话
          </button>
          <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            历史对话
          </div>
          {loading ? (
            <p className="px-1 py-4 text-center text-xs text-slate-400">加载中…</p>
          ) : conversations.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-slate-400">暂无对话</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadConversation(c.id)}
                className={`flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedId === c.id
                    ? "border-violet-300 bg-violet-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="truncate text-sm font-medium text-slate-700">
                  {c.title}
                </span>
                <span className="mt-0.5 text-xs text-slate-400">
                  {formatDate(c.updatedAt)} · {c.messageCount} 条
                </span>
              </button>
            ))
          )}
        </aside>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[56vh] min-h-[300px]">
            {messages.length === 0 && (
              <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
                <p className="text-slate-500">
                  遇到不理解的知识点？直接提问，辅导智能体将基于课程知识库作答。
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-violet-600 px-4 py-2.5 text-white">
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-slate-50 px-4 py-3 text-slate-800">
                    {m.content ? (
                      <>
                        <DocView content={m.content} />
                        {!running && (
                          <div className="mt-2 border-t border-slate-200 pt-2">
                            <SpeakButton text={toPlainText(m.content)} label="朗读回答" />
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex gap-1 text-slate-400">
                        <Dot /> <Dot /> <Dot />
                      </span>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {error && (
            <div className="border-t border-slate-100 px-5 py-2 text-xs text-red-600">
              ✕ {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2 border-t border-slate-100 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例如：哈希冲突怎么解决？"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="submit"
              disabled={running || !input.trim()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? "作答中…" : "提问"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function toPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "（代码块）")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\|/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function Dot() {
  return (
    <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hh}:${mm}`;
}
