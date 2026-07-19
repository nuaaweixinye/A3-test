"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MasterySlider } from "@/frontend/components/resource/MasterySlider";
import { regenerateResource } from "@/frontend/lib/regenerate-resource";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import {
  analyzeResourceQuality,
  qualityBadgeClass,
  qualityLabel,
} from "@/frontend/lib/resource-quality";
import type { ResourceCardState, ResourceType } from "@/backend/types";

const META: Record<ResourceType, { label: string; badge: string; icon: string }> = {
  design: { label: "资源设计/PPT", badge: "bg-indigo-50 text-indigo-700", icon: "P" },
  doc: { label: "讲解文档", badge: "bg-blue-50 text-blue-700", icon: "文" },
  quiz: { label: "练习题库", badge: "bg-rose-50 text-rose-700", icon: "题" },
  mindmap: { label: "思维导图", badge: "bg-amber-50 text-amber-700", icon: "图" },
  video: { label: "教学视频", badge: "bg-violet-50 text-violet-700", icon: "视" },
  code: { label: "代码实操", badge: "bg-emerald-50 text-emerald-700", icon: "码" },
  reading: { label: "拓展阅读", badge: "bg-cyan-50 text-cyan-700", icon: "读" },
};

export function ResourceCard({
  card,
  weak = false,
}: {
  card: ResourceCardState;
  weak?: boolean;
}) {
  const meta = META[card.resType];
  const quality = analyzeResourceQuality(card);
  const ref = useRef<HTMLElement | null>(null);
  const markViewed = useLearningStore((state) => state.markViewed);
  const addViewTime = useLearningStore((state) => state.addViewTime);
  const [regenerating, setRegenerating] = useState(false);
  const failed = isFailedResource(card);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            markViewed(card.topic);
            if (!timer) timer = setInterval(() => addViewTime(card.topic, 2), 2000);
          } else if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [addViewTime, card.topic, markViewed]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateResource(card);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <article
      ref={ref}
      className={`group flex min-h-64 flex-col rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        failed ? "border-rose-200" : "border-slate-200 hover:border-blue-300"
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-sm font-semibold text-white">
            {meta.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>
                {meta.label}
              </span>
              {weak && (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-rose-200">
                  建议复习
                </span>
              )}
              {failed ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-rose-200">
                  生成失败
                </span>
              ) : (
                card.done && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${qualityBadgeClass(
                      quality.level,
                    )}`}
                  >
                    {qualityLabel(quality.level)}
                  </span>
                )
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-800">
              {card.title}
            </h3>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-500">
          {regenerating || !card.done ? "生成中" : "已完成"}
        </span>
      </header>

      <div className="mt-4 flex-1">
        {card.content ? (
          <p
            className={`line-clamp-5 text-sm leading-6 ${
              failed ? "text-rose-600" : "text-slate-500"
            }`}
          >
            {card.content.replace(/[#*`>]/g, "").slice(0, 240)}
            {card.content.length > 240 ? "..." : ""}
          </p>
        ) : (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-400">
            等待智能体产出...
          </div>
        )}
      </div>

      {card.done && !failed && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
            <Metric label="知识库" value={`${quality.knowledgeSources.length}`} />
            <Metric label="核查" value={quality.factScore === null ? "-" : `${quality.factScore}%`} />
            <Metric
              label="交叉"
              value={
                quality.crossCheckPassed === null
                  ? "待验证"
                  : quality.crossCheckPassed
                    ? "通过"
                    : "复核"
              }
            />
          </div>
          {quality.usesAiSupplement && (
            <p className="mt-2 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700">
              含 AI 基于知识库补全
            </p>
          )}
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        {card.done && !failed ? <MasterySlider topic={card.topic} /> : <span />}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              failed
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {regenerating ? "重新生成中..." : "重新生成"}
          </button>
          <Link
            href={`/learn/${card.id}`}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            查看详情
          </Link>
        </div>
      </div>
    </article>
  );
}

function isFailedResource(card: ResourceCardState): boolean {
  return /^>\s*生成失败|生成失败：|接口限流|QPS/i.test(card.content.trim());
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-slate-50 px-2 py-1">
      <span className="text-slate-400">{label}</span>
      <span className="ml-1 font-semibold text-slate-700">{value}</span>
    </span>
  );
}
