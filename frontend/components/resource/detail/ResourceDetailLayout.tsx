"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MasterySlider } from "@/frontend/components/resource/MasterySlider";
import type { FactCheckResult, ResourceType } from "@/backend/types";

const META: Record<ResourceType, { label: string; badge: string; icon: string }> = {
  doc: { label: "讲解文档", badge: "bg-blue-50 text-blue-700", icon: "📄" },
  quiz: { label: "练习题库", badge: "bg-rose-50 text-rose-700", icon: "❓" },
  mindmap: { label: "思维导图", badge: "bg-amber-50 text-amber-700", icon: "🧠" },
  video: { label: "教学视频", badge: "bg-violet-50 text-violet-700", icon: "🎬" },
  code: { label: "代码实操", badge: "bg-emerald-50 text-emerald-700", icon: "💻" },
  reading: { label: "拓展阅读", badge: "bg-cyan-50 text-cyan-700", icon: "📚" },
};

export function ResourceDetailLayout({
  resType,
  title,
  topic,
  sources,
  factCheck,
  children,
}: {
  resType: ResourceType;
  title: string;
  topic: string;
  sources: string[];
  factCheck?: FactCheckResult;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const meta = META[resType];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          ← 返回
        </button>
        <span className="text-lg">{meta.icon}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>
          {meta.label}
        </span>
        <h1 className="flex-1 truncate text-lg font-bold text-slate-800">
          {title}
        </h1>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
          {topic}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <MasterySlider topic={topic} />
        {sources.length > 0 && (
          <span className="text-xs text-slate-400">
            引用：{sources.join("、")}
          </span>
        )}
      </div>

      {factCheck && <FactCheckView fc={factCheck} />}
    </div>
  );
}

function FactCheckView({ fc }: { fc: FactCheckResult }) {
  const [open, setOpen] = useState(false);
  const ok = fc.score >= 80;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => fc.flagged.length && setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5"
      >
        <span className={ok ? "text-emerald-600" : "text-amber-600"}>
          🔍 事实核查：{fc.score}%
        </span>
        <span className="text-slate-400">
          （{fc.checked > 0 ? `已核 ${fc.checked} 条` : "无可核声明"}
          {fc.flagged.length > 0 ? `，${fc.flagged.length} 条待核` : ""}）
        </span>
      </button>
      {open && fc.flagged.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-4 text-slate-500">
          {fc.flagged.map((f, i) => (
            <li key={i} className="list-disc">
              未在知识库找到佐证：{f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
