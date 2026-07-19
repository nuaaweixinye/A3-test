"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { analyzeResourceQuality } from "@/frontend/lib/resource-quality";
import type {
  LearningPath,
  ResourceCardState,
  ResourceType,
  TopicProgress,
} from "@/backend/types";

const RESOURCE_LABEL: Record<ResourceType, string> = {
  design: "资源设计/PPT",
  doc: "讲解文档",
  quiz: "练习题库",
  mindmap: "思维导图",
  video: "教学视频",
  code: "代码实操",
  reading: "拓展阅读",
};

interface LearnRecord {
  id: string;
  topic: string;
  path: LearningPath;
  resources: ResourceCardState[];
  progress: Record<string, TopicProgress>;
  createdAt: string;
}

interface Stats {
  totalSessions: number;
  totalResources: number;
  totalTutorConvs: number;
  evalCount: number;
  avgScore: number;
}

export default function ReviewCenterPage() {
  const [records, setRecords] = useState<LearnRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/records").then((response) => response.json()),
      fetch("/api/profile/stats").then((response) => response.json()),
    ])
      .then(([recordData, statsData]) => {
        setRecords(recordData.records || []);
        if (!statsData.error) setStats(statsData);
      })
      .finally(() => setLoading(false));
  }, []);

  const report = useMemo(() => buildReviewReport(records), [records]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-slate-400">加载复盘中心中...</p>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
            Review Center
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">复盘中心</h1>
          <p className="mt-1 text-sm text-slate-500">
            汇总学习记录、资源质量和薄弱主题，帮助你决定下一轮该复习什么、用什么资源复习。
          </p>
        </div>
        <Link
          href="/learn"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          返回学习记录
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="学习会话" value={stats?.totalSessions ?? records.length} />
        <Metric label="生成资源" value={stats?.totalResources ?? report.resourceCount} />
        <Metric label="平均评估" value={`${stats?.avgScore ?? 0} 分`} />
        <Metric label="资源质量" value={`${report.avgQuality} 分`} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">最近学习会话</h2>
          {records.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              暂无可复盘的学习记录。
            </div>
          ) : (
            records.slice(0, 8).map((record) => {
              const resources = dedupeResources(record.resources || []);
              const qualities = resources.map(analyzeResourceQuality);
              const avg =
                qualities.length > 0
                  ? Math.round(
                      qualities.reduce((sum, quality) => sum + quality.score, 0) /
                        qualities.length,
                    )
                  : 0;
              const weakTopics = Object.entries(record.progress || {})
                .filter(([, progress]) => progress.mastery > 0 && progress.mastery < 60)
                .map(([topic]) => topic);

              return (
                <article
                  key={record.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">
                        {record.topic}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(record.createdAt)} · {record.path?.steps?.length ?? 0} 步路径 · {resources.length} 个资源
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                      质量 {avg}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {resources.map((resource) => (
                      <span
                        key={resource.id}
                        className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                      >
                        {RESOURCE_LABEL[resource.resType]}
                      </span>
                    ))}
                  </div>
                  {weakTopics.length > 0 && (
                    <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      优先复习：{weakTopics.slice(0, 4).join("、")}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>

        <aside className="space-y-4">
          <Panel title="资源类型覆盖">
            <div className="space-y-2">
              {Object.entries(report.typeCount).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{RESOURCE_LABEL[type as ResourceType]}</span>
                  <span className="font-semibold text-slate-800">{count}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="薄弱主题排行">
            {report.weakTopics.length === 0 ? (
              <p className="text-sm text-slate-400">暂无明显薄弱主题。</p>
            ) : (
              <div className="space-y-2">
                {report.weakTopics.slice(0, 6).map(([topic, count]) => (
                  <div key={topic} className="rounded-lg bg-rose-50 px-3 py-2">
                    <p className="truncate text-sm font-medium text-rose-700">{topic}</p>
                    <p className="text-xs text-rose-500">{count} 次低掌握记录</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="下一步复盘建议">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>先复习低于 60 分的主题，再进入新内容。</li>
              <li>每个薄弱主题优先搭配讲解文档、题库和教学视频。</li>
              <li>对质量低于 60 分的资源重新生成或补充知识库。</li>
              <li>完成练习后去“评估”页回写画像，更新后续学习路径。</li>
            </ul>
          </Panel>
        </aside>
      </section>
    </div>
  );
}

function buildReviewReport(records: LearnRecord[]) {
  const typeCount: Record<ResourceType, number> = {
    design: 0,
    doc: 0,
    quiz: 0,
    mindmap: 0,
    video: 0,
    code: 0,
    reading: 0,
  };
  const weakMap = new Map<string, number>();
  const qualities: number[] = [];

  for (const record of records) {
    for (const resource of dedupeResources(record.resources || [])) {
      typeCount[resource.resType] += 1;
      qualities.push(analyzeResourceQuality(resource).score);
    }
    for (const [topic, progress] of Object.entries(record.progress || {})) {
      if (progress.mastery > 0 && progress.mastery < 60) {
        weakMap.set(topic, (weakMap.get(topic) ?? 0) + 1);
      }
    }
  }

  return {
    resourceCount: qualities.length,
    avgQuality:
      qualities.length > 0
        ? Math.round(qualities.reduce((sum, score) => sum + score, 0) / qualities.length)
        : 0,
    typeCount,
    weakTopics: Array.from(weakMap.entries()).sort((a, b) => b[1] - a[1]),
  };
}

function dedupeResources(resources: ResourceCardState[]): ResourceCardState[] {
  const byType = new Map<ResourceType, ResourceCardState>();
  for (const resource of resources) byType.set(resource.resType, resource);
  return Array.from(byType.values());
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </section>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(
    2,
    "0",
  )}:${String(date.getMinutes()).padStart(2, "0")}`;
}
