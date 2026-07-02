"use client";

import Link from "next/link";
import { useLearningStore } from "@/lib/store/useLearningStore";
import { DocView } from "@/components/resource/DocView";
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
  const resources = useLearningStore((s) => s.resources);
  const streamingDoc = useLearningStore((s) => s.streamingDoc);
  const running = useLearningStore((s) => s.running);

  const latest = resources[resources.length - 1];
  const showStreaming = running && streamingDoc && !latest;
  const docContent = latest?.content || streamingDoc || "";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold">学习中心</h1>
        <p className="text-sm text-slate-500">
          路径规划智能体输出 · 文档生成智能体产出（基于知识库 RAG）
        </p>
      </header>

      {!path && !docContent && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          暂无学习内容。
          <Link href="/" className="ml-2 text-blue-600 underline">
            去发起一次对话
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* 学习路径时间线 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            {path?.path_title ?? "学习路径"}
          </h2>
          {path?.estimated_time && (
            <p className="mb-3 text-xs text-slate-400">预计 {path.estimated_time}</p>
          )}
          <ol className="relative space-y-4 border-l border-slate-200 pl-4">
            {(path?.steps ?? []).map((step) => (
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
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        t.type === "doc"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
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

        {/* 生成的讲解文档 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              讲解文档{latest ? ` · ${latest.title}` : showStreaming ? "（生成中…）" : ""}
            </h2>
            {latest && latest.sources.length > 0 && (
              <span className="text-xs text-slate-400">
                引用：{latest.sources.join("、")}
              </span>
            )}
          </div>
          {docContent ? (
            <DocView content={docContent} />
          ) : (
            <p className="text-sm text-slate-400">暂无文档，对话后由文档智能体生成。</p>
          )}
        </section>
      </div>
    </div>
  );
}
