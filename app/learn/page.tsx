"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { ResourceCard } from "@/frontend/components/resource/ResourceCard";
import type { LearningPath, ResourceCardState, TopicProgress, ResourceType } from "@/backend/types";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  doc: "文档",
  quiz: "题库",
  mindmap: "导图",
  video: "视频",
  code: "代码",
  reading: "阅读",
};

interface LearnRecord {
  id: string;
  topic: string;
  path: LearningPath;
  resources: ResourceCardState[];
  progress: Record<string, TopicProgress>;
  createdAt: string;
}

export default function LearnPage() {
  const [records, setRecords] = useState<LearnRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const storeOrder = useLearningStore((s) => s.resourceOrder);
  const storeCards = useLearningStore((s) => s.resourceCards);
  const storePath = useLearningStore((s) => s.path);
  const weakTopics = useLearningStore((s) => s.weakTopics);

  const hasStoreData = storeOrder.length > 0;

  useEffect(() => {
    fetch("/api/records")
      .then((res) => res.json())
      .then((data) => {
        const list: LearnRecord[] = data.records || [];
        setRecords(list);
        if (list.length > 0) setSelectedId(list[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function loadRecord(record: LearnRecord) {
    setSelectedId(record.id);
    const cards: Record<string, ResourceCardState> = {};
    const order: string[] = [];
    for (const r of record.resources) {
      cards[r.id] = { ...r, done: true };
      order.push(r.id);
    }
    useLearningStore.setState({
      resourceCards: cards,
      resourceOrder: order,
      path: record.path,
      progress: record.progress || {},
    });
  }

  const currentCards = storeOrder
    .map((id) => storeCards[id])
    .filter(Boolean);
  const doneCount = currentCards.filter((c) => c.done).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">学习记录</h1>
          <p className="text-sm text-slate-500">
            查看历史学习会话 · 点击会话查看 6 种资源
          </p>
        </div>
        {currentCards.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            资源 {doneCount}/{currentCards.length} 已完成
          </span>
        )}
      </header>

      {weakTopics.length > 0 && (
        <div className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
          🎯 评估建议重点复习：{weakTopics.map((t) => t).join("、")}
          <Link href="/eval" className="ml-2 underline">
            查看评估
          </Link>
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">加载学习记录中…</p>
      ) : records.length === 0 && !hasStoreData ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          暂无学习记录。
          <Link href="/" className="ml-2 text-blue-600 underline">
            去资源生成页面发起对话
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="h-fit space-y-2">
            {hasStoreData && (
              <div className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                当前会话
              </div>
            )}
            {hasStoreData && (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedId === null
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {storePath?.path_title || "当前会话"}
                  </p>
                  <p className="text-xs text-slate-400">刚生成 · {storeOrder.length} 个资源</p>
                </div>
                <span className="shrink-0 text-xs text-blue-600">●</span>
              </button>
            )}

            {records.length > 0 && (
              <div className={hasStoreData ? "mb-1 mt-3 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400" : "mb-1 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"}>
                历史记录
              </div>
            )}
            {records.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => loadRecord(r)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedId === r.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {r.topic}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(r.createdAt)} · {r.resources?.length || 0} 个资源
                  </p>
                </div>
                {selectedId === r.id && (
                  <span className="shrink-0 text-xs text-blue-600">●</span>
                )}
              </button>
            ))}
          </aside>

          <section className="space-y-4">
            {storePath && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-1 text-sm font-semibold text-slate-700">
                  {storePath.path_title}
                </h2>
                {storePath.estimated_time && (
                  <p className="mb-3 text-xs text-slate-400">预计 {storePath.estimated_time}</p>
                )}
                <ol className="relative space-y-3 border-l border-slate-200 pl-4">
                  {storePath.steps.map((step) => (
                    <li key={step.step} className="relative">
                      <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                      <h3 className="text-sm font-semibold text-slate-800">
                        {step.step}. {step.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-500">{step.description}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {step.resource_tasks.map((t, i) => (
                          <span
                            key={i}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                          >
                            {RESOURCE_LABEL[t.type]} · {t.topic}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {currentCards.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                选择左侧会话查看资源
              </p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {currentCards.map((card) => (
                  <ResourceCard
                    key={card.id}
                    card={card}
                    weak={weakTopics.includes(card.topic)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hh}:${mm}`;
}
