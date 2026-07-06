"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MasterySlider } from "@/frontend/components/resource/MasterySlider";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { ResourceCardState, ResourceType } from "@/backend/types";

const META: Record<ResourceType, { label: string; badge: string; icon: string }> = {
  doc: { label: "讲解文档", badge: "bg-blue-50 text-blue-700", icon: "📄" },
  quiz: { label: "练习题库", badge: "bg-rose-50 text-rose-700", icon: "❓" },
  mindmap: { label: "思维导图", badge: "bg-amber-50 text-amber-700", icon: "🧠" },
  video: { label: "教学视频", badge: "bg-violet-50 text-violet-700", icon: "🎬" },
  code: { label: "代码实操", badge: "bg-emerald-50 text-emerald-700", icon: "💻" },
  reading: { label: "拓展阅读", badge: "bg-cyan-50 text-cyan-700", icon: "📚" },
};

export function ResourceCard({
  card,
  weak = false,
}: {
  card: ResourceCardState;
  weak?: boolean;
}) {
  const meta = META[card.resType];
  const ref = useRef<HTMLAnchorElement | null>(null);
  const markViewed = useLearningStore((s) => s.markViewed);
  const addViewTime = useLearningStore((s) => s.addViewTime);

  // 浏览行为采集（评估输入）：可见时标记并累加时长
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            markViewed(card.topic);
            if (!timer) {
              timer = setInterval(() => addViewTime(card.topic, 2), 2000);
            }
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
  }, [card.topic, markViewed, addViewTime]);

  return (
    <Link
      ref={ref}
      href={`/learn/${card.id}`}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md cursor-pointer"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}
          >
            {meta.label}
          </span>
          <span className="truncate text-sm font-semibold text-slate-700">
            {card.title}
          </span>
          {weak && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-rose-200">
              建议复习
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-slate-400">
          {card.done ? "✓ 已完成" : "生成中…"}
        </span>
      </header>

      <div className="flex-1">
        {card.content ? (
          <p className="line-clamp-4 text-sm leading-relaxed text-slate-500">
            {card.content.replace(/[#*`>]/g, "").slice(0, 200)}
            {card.content.length > 200 ? "…" : ""}
          </p>
        ) : (
          <p className="text-sm text-slate-400">等待智能体产出…</p>
        )}
      </div>

      {card.done && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <MasterySlider topic={card.topic} />
          <span className="text-xs font-medium text-blue-600">
            查看详情 →
          </span>
        </div>
      )}
    </Link>
  );
}
