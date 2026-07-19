"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MasterySlider } from "@/frontend/components/resource/MasterySlider";
import {
  analyzeResourceQuality,
  qualityBadgeClass,
  qualityLabel,
} from "@/frontend/lib/resource-quality";
import type { CrossCheckResult, FactCheckResult, ResourceType } from "@/backend/types";

const META: Record<ResourceType, { label: string; badge: string; icon: string }> = {
  design: { label: "资源设计/PPT", badge: "bg-indigo-50 text-indigo-700", icon: "P" },
  doc: { label: "讲解文档", badge: "bg-blue-50 text-blue-700", icon: "文" },
  quiz: { label: "练习题库", badge: "bg-rose-50 text-rose-700", icon: "题" },
  mindmap: { label: "思维导图", badge: "bg-amber-50 text-amber-700", icon: "图" },
  video: { label: "教学视频", badge: "bg-violet-50 text-violet-700", icon: "视" },
  code: { label: "代码实操", badge: "bg-emerald-50 text-emerald-700", icon: "码" },
  reading: { label: "拓展阅读", badge: "bg-cyan-50 text-cyan-700", icon: "读" },
};

export function ResourceDetailLayout({
  resType,
  title,
  topic,
  sources,
  factCheck,
  crossCheck,
  content,
  actions,
  children,
}: {
  resType: ResourceType;
  title: string;
  topic: string;
  sources: string[];
  factCheck?: FactCheckResult;
  crossCheck?: CrossCheckResult;
  content: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const meta = META[resType];
  const quality = analyzeResourceQuality({
    id: "",
    resType,
    title,
    topic,
    content,
    sources,
    fact_check: factCheck,
    crossCheck,
    done: true,
  });

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            返回
          </button>
          <span
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${meta.badge}`}
          >
            {meta.icon}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>
            {meta.label}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
            {topic}
          </span>
          <div className="ml-auto">{actions}</div>
        </div>
        <h1 className="mt-4 text-2xl font-bold leading-tight text-slate-900">{title}</h1>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">知识依据与生成质量</h2>
            <p className="mt-1 text-xs text-slate-500">
              汇总知识库覆盖、AI 补充、事实核查和多 Agent 交叉验证结果。
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${qualityBadgeClass(
              quality.level,
            )}`}
          >
            {qualityLabel(quality.level)} · {quality.score} 分
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <QualityMetric label="知识库来源" value={`${quality.knowledgeSources.length} 个`} />
          <QualityMetric label="AI 补充" value={quality.usesAiSupplement ? "已启用" : "未启用"} />
          <QualityMetric label="事实核查" value={quality.factScore === null ? "待核查" : `${quality.factScore}%`} />
          <QualityMetric
            label="交叉验证"
            value={
              quality.crossCheckPassed === null
                ? "待验证"
                : quality.crossCheckPassed
                  ? "通过"
                  : "需复核"
            }
          />
        </div>

        {sources.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {sources.map((source) => (
              <span
                key={source}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              >
                {source}
              </span>
            ))}
          </div>
        )}

        {quality.issues.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-amber-700">
            {quality.issues.slice(0, 5).map((issue, index) => (
              <li key={index}>需要关注：{issue}</li>
            ))}
          </ul>
        )}
      </section>

      <main className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </main>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <MasterySlider topic={topic} />
        {sources.length > 0 && (
          <span className="text-xs text-slate-400">引用：{sources.join("、")}</span>
        )}
      </section>

      {factCheck && <FactCheckView fc={factCheck} />}
    </div>
  );
}

function QualityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function FactCheckView({ fc }: { fc: FactCheckResult }) {
  const [open, setOpen] = useState(false);
  const ok = fc.score >= 80;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => fc.flagged.length && setOpen((value) => !value)}
        className="inline-flex flex-wrap items-center gap-1.5 text-left"
      >
        <span className={ok ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
          事实核查：{fc.score}%
        </span>
        <span className="text-slate-400">
          {fc.checked > 0 ? `已核 ${fc.checked} 条` : "暂无可核声明"}
          {fc.flagged.length > 0 ? `，${fc.flagged.length} 条待核` : ""}
        </span>
      </button>

      {open && fc.flagged.length > 0 && (
        <ul className="mt-3 space-y-1 pl-4 text-slate-500">
          {fc.flagged.map((item, index) => (
            <li key={index} className="list-disc">
              未在知识库找到佐证：{item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
