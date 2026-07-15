"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { EvalRadar } from "@/frontend/components/eval/EvalRadar";
import type { EvaluationResult } from "@/backend/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface EvalHistoryItem {
  id: string;
  overallScore: number;
  createdAt: string;
}

const TREND_LABEL = {
  improving: "稳步提升",
  steady: "保持平稳",
  needs_review: "需要复习",
} as const;

const TREND_COLOR = {
  improving: "text-emerald-600",
  steady: "text-amber-600",
  needs_review: "text-rose-600",
} as const;

export default function EvalPage() {
  const resourceOrder = useLearningStore((s) => s.resourceOrder);
  const resourceCards = useLearningStore((s) => s.resourceCards);
  const progress = useLearningStore((s) => s.progress);
  const profile = useLearningStore((s) => s.profile);
  const setProfile = useLearningStore((s) => s.setProfile);
  const setWeakTopics = useLearningStore((s) => s.setWeakTopics);

  const [report, setReport] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [history, setHistory] = useState<EvalHistoryItem[]>([]);

  async function refreshHistory() {
    try {
      const res = await fetch("/api/eval/history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch {}
  }

  useEffect(() => {
    fetch("/api/eval/history")
      .then((res) => res.json())
      .then((data) => {
        if (data.history) setHistory(data.history);
      })
      .catch(() => {});
  }, []);

  const topics = Array.from(
    new Set(
      resourceOrder
        .map((id) => resourceCards[id]?.topic)
        .filter((t): t is string => Boolean(t)),
    ),
  );

  async function runEval() {
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, progress, topics }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as EvaluationResult;
      setReport(data);
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function applyRecommendations() {
    if (!report) return;
    if (profile) {
      setProfile({
        ...profile,
        knowledge_level: {
          ...profile.knowledge_level,
          ...report.profile_update.knowledge_level,
        },
      });
    }
    setWeakTopics(report.path_adjustment.focus_topics);
    setApplied(true);
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        还没有可评估的学习内容。
        <Link href="/" className="ml-2 text-blue-600 underline">
          先去生成学习资源
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">学习效果评估</h1>
          <p className="text-sm text-slate-500">
            基于自评掌握度 + 浏览行为的多维度评估 · 回写画像并动态调整路径
          </p>
        </div>
        <button
          onClick={runEval}
          disabled={loading}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "评估中…" : report ? "重新评估" : "生成评估报告"}
        </button>
      </header>

      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            评估趋势 · 共 {history.length} 次记录
          </h2>
          <ReactECharts
            style={{ height: "200px" }}
            option={{
              tooltip: { trigger: "axis" },
              grid: { left: 30, right: 20, top: 10, bottom: 30 },
              xAxis: {
                type: "category",
                data: history
                  .slice()
                  .reverse()
                  .map((h) => {
                    const d = new Date(h.createdAt);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }),
                axisLabel: { fontSize: 11 },
              },
              yAxis: {
                type: "value",
                min: 0,
                max: 100,
                axisLabel: { fontSize: 11 },
              },
              series: [
                {
                  type: "line",
                  smooth: true,
                  data: history
                    .slice()
                    .reverse()
                    .map((h) => h.overallScore),
                  itemStyle: { color: "#059669" },
                  areaStyle: { opacity: 0.1 },
                  symbolSize: 6,
                },
              ],
            }}
          />
        </section>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-600">
          ✕ {error}
        </div>
      )}

      {report && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 雷达 + 总分 */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-700">主题掌握度</h2>
              <span className="text-xs text-slate-400">
                总分{" "}
                <span className="text-lg font-bold text-emerald-600">
                  {report.overall_score}
                </span>{" "}
                ·{" "}
                <span className={TREND_COLOR[report.progress_trend]}>
                  {TREND_LABEL[report.progress_trend]}
                </span>
              </span>
            </div>
            <EvalRadar topics={topics} mastery={report.mastery} />
          </section>

          {/* 建议 + 闭环 */}
          <section className="space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                薄弱主题
              </h3>
              {report.weak_points.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {report.weak_points.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-400">暂无明显薄弱主题 🎉</span>
              )}
              {report.strong_points.length > 0 && (
                <>
                  <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-700">
                    掌握扎实
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {report.strong_points.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">学习建议</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-500">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">
                路径调整建议
              </h3>
              <p className="text-sm text-slate-600">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  {report.path_adjustment.action}
                </span>{" "}
                {report.path_adjustment.summary}
              </p>
              <button
                onClick={applyRecommendations}
                disabled={applied}
                className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {applied ? "✓ 已回写画像并标注弱点" : "应用建议（回写画像 + 标注弱点）"}
              </button>
              {applied && (
                <Link
                  href="/learn"
                  className="ml-2 inline-block text-xs text-indigo-600 underline"
                >
                  前往学习中心查看
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
