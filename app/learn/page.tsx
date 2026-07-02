"use client";

import Link from "next/link";
import { useLearningStore } from "@/lib/store/useLearningStore";
import { ResourceCard } from "@/components/resource/ResourceCard";
import type { ResourceType } from "@/lib/types";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  doc: "文档",
  quiz: "题库",
  mindmap: "导图",
  video: "视频",
  code: "代码",
  reading: "阅读",
};

export default function LearnPage() {
  const path = useLearningStore((s) => s.path);
  const resourceOrder = useLearningStore((s) => s.resourceOrder);
  const resourceCards = useLearningStore((s) => s.resourceCards);

  const cards = resourceOrder
    .map((id) => resourceCards[id])
    .filter(Boolean);
  const doneCount = cards.filter((c) => c.done).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">学习中心</h1>
          <p className="text-sm text-slate-500">
            路径规划智能体输出 · 6 个资源生成智能体并行产出（基于知识库 RAG）
          </p>
        </div>
        {cards.length > 0 && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
            资源 {doneCount}/{cards.length} 已完成
          </span>
        )}
      </header>

      {!path && cards.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          暂无学习内容。
          <Link href="/" className="ml-2 text-blue-600 underline">
            去发起一次对话
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* 学习路径时间线 */}
        {path && (
          <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">
              {path.path_title}
            </h2>
            {path.estimated_time && (
              <p className="mb-3 text-xs text-slate-400">预计 {path.estimated_time}</p>
            )}
            <ol className="relative space-y-4 border-l border-slate-200 pl-4">
              {path.steps.map((step) => (
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
                  <p className="mt-1 text-[10px] text-slate-400">
                    约 {step.estimated_minutes} 分钟
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 资源画廊 */}
        <section className="grid gap-5 sm:grid-cols-2">
          {cards.length === 0 && path && (
            <p className="text-sm text-slate-400">资源生成中…</p>
          )}
          {cards.map((card) => (
            <ResourceCard key={card.id} card={card} />
          ))}
        </section>
      </div>
    </div>
  );
}
