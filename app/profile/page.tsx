"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { ProfileRadar } from "@/frontend/components/profile/ProfileRadar";
import { showToast } from "@/frontend/components/ui/Toast";
import type {
  CognitiveStyle,
  LearningGoal,
  LearningPace,
  StudentProfile,
} from "@/backend/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const GOAL_LABELS: Record<LearningGoal, string> = {
  exam: "考试备考",
  project: "项目实践",
  research: "学术研究",
  interest: "兴趣学习",
};

const PACE_LABELS: Record<LearningPace, string> = {
  fast: "快速",
  medium: "中等",
  slow: "稳扎稳打",
};

const STYLE_LABELS: Record<CognitiveStyle, string> = {
  visual: "视觉型",
  auditory: "听觉型",
  reading: "阅读型",
  kinesthetic: "动手型",
};

interface Stats {
  totalSessions: number;
  totalResources: number;
  totalTutorConvs: number;
  evalCount: number;
  avgScore: number;
  latestTrend: string;
  streak: number;
  activity: Record<string, number>;
  scoreHistory: Array<{ score: number; date: string }>;
}

function masteryColor(v: number): string {
  if (v < 40) return "bg-rose-500";
  if (v < 70) return "bg-amber-500";
  return "bg-emerald-500";
}

export default function ProfilePage() {
  const profile = useLearningStore((s) => s.profile);
  const setProfile = useLearningStore((s) => s.setProfile);
  const [newInterest, setNewInterest] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSugg, setLoadingSugg] = useState(false);

  const fetchStats = useCallback(() => {
    fetch("/api/profile/stats")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) setStats(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function update(patch: Partial<StudentProfile>) {
    if (!profile) return;
    setProfile({ ...profile, ...patch });
    showToast("画像已更新", "success");
  }

  function updateKnowledge(key: string, value: number) {
    if (!profile) return;
    setProfile({
      ...profile,
      knowledge_level: { ...profile.knowledge_level, [key]: value },
    });
  }

  function removeKnowledge(key: string) {
    if (!profile) return;
    const next = { ...profile.knowledge_level };
    delete next[key];
    setProfile({ ...profile, knowledge_level: next });
  }

  function addInterest() {
    const val = newInterest.trim();
    if (!val || !profile) return;
    if (profile.interests.includes(val)) {
      showToast("该兴趣已存在", "error");
      return;
    }
    setProfile({ ...profile, interests: [...profile.interests, val] });
    setNewInterest("");
  }

  function removeInterest(idx: number) {
    if (!profile) return;
    setProfile({
      ...profile,
      interests: profile.interests.filter((_, i) => i !== idx),
    });
  }

  async function generateSuggestions() {
    setLoadingSugg(true);
    try {
      const res = await fetch("/api/profile/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      showToast("建议生成失败", "error");
    }
    setLoadingSugg(false);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">学生学习画像</h1>
          <p className="text-sm text-slate-500">
            6 维度自动抽取 · 可手动调整 · 实时学习统计
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generateSuggestions}
            disabled={loadingSugg || !profile}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {loadingSugg ? "生成中…" : "✦ AI 学习建议"}
          </button>
          {!profile && (
            <Link
              href="/"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              去发起对话
            </Link>
          )}
        </div>
      </header>

      {/* 统计仪表盘 */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="学习会话" value={stats.totalSessions} icon="📚" />
          <StatCard label="生成资源" value={stats.totalResources} icon="📄" />
          <StatCard
            label="辅导对话"
            value={stats.totalTutorConvs}
            icon="💬"
          />
          <StatCard
            label="平均评估"
            value={stats.avgScore}
            suffix="分"
            icon="📊"
          />
        </div>
      )}

      {/* AI 建议 */}
      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-violet-700">
            ✦ AI 个性化学习建议
          </h3>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg bg-white px-3 py-2 text-sm text-slate-700"
              >
                <span className="text-violet-500">{i + 1}.</span>
                {s}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 雷达图 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">维度雷达</h2>
          <ProfileRadar profile={profile} />
        </section>

        {/* 活动热力图 + 评估趋势 */}
        <section className="space-y-4">
          {stats && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  学习活动
                </h3>
                {stats.streak > 0 && (
                  <span className="text-xs text-orange-500">
                    🔥 连续 {stats.streak} 天
                  </span>
                )}
              </div>
              <ActivityHeatmap activity={stats.activity} />
            </div>
          )}

          {stats && stats.scoreHistory.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                评估分数趋势
              </h3>
              <ReactECharts
                style={{ height: "140px" }}
                option={{
                  tooltip: { trigger: "axis" },
                  grid: { left: 28, right: 12, top: 8, bottom: 24 },
                  xAxis: {
                    type: "category",
                    data: stats.scoreHistory.map((h) => {
                      const d = new Date(h.date);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }),
                    axisLabel: { fontSize: 10 },
                  },
                  yAxis: {
                    type: "value",
                    min: 0,
                    max: 100,
                    axisLabel: { fontSize: 10 },
                  },
                  series: [
                    {
                      type: "line",
                      smooth: true,
                      data: stats.scoreHistory.map((h) => h.score),
                      itemStyle: { color: "#7c3aed" },
                      areaStyle: { opacity: 0.1 },
                      symbolSize: 5,
                    },
                  ],
                }}
              />
            </div>
          )}
        </section>
      </div>

      {/* 知识基础 — 分色 + 趋势 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            1. 知识基础水平
          </h3>
          <div className="flex gap-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> &lt;40
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> 40-70
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> &gt;70
            </span>
          </div>
        </div>
        {profile && Object.keys(profile.knowledge_level).length > 0 ? (
          <div className="space-y-2.5">
            {Object.entries(profile.knowledge_level).map(([k, v]) => (
              <div key={k} className="group flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs text-slate-600">
                    {k}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={v}
                    onChange={(e) => updateKnowledge(k, Number(e.target.value))}
                    className="h-1.5 flex-1 accent-blue-600"
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className={`h-2 w-8 rounded-full ${masteryColor(v)}`}
                    />
                    <span className="w-6 text-right text-xs tabular-nums text-slate-500">
                      {v}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeKnowledge(k)}
                    className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
                  >
                    ✕
                  </button>
                </div>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">暂无数据</span>
        )}
      </section>

      {/* 剩余维度 — 网格 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 认知风格 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            2. 认知学习风格
          </h3>
          {profile && (
            <div className="flex gap-1.5">
              {(Object.keys(STYLE_LABELS) as CognitiveStyle[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => update({ cognitive_style: s })}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    profile.cognitive_style === s
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {STYLE_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 易错点 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            3. 易错点偏好
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(profile?.error_patterns ?? []).map((t, i) => (
              <span
                key={i}
                className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-600"
              >
                {t}
              </span>
            ))}
            {(!profile?.error_patterns ||
              profile.error_patterns.length === 0) && (
              <span className="text-xs text-slate-400">暂无数据</span>
            )}
          </div>
        </div>

        {/* 学习目标 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            4. 学习目标
          </h3>
          {profile && (
            <select
              value={profile.learning_goal}
              onChange={(e) =>
                update({ learning_goal: e.target.value as LearningGoal })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              {(Object.keys(GOAL_LABELS) as LearningGoal[]).map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABELS[g]}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 学习节奏 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            5. 学习节奏
          </h3>
          {profile && (
            <select
              value={profile.learning_pace}
              onChange={(e) =>
                update({ learning_pace: e.target.value as LearningPace })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
            >
              {(Object.keys(PACE_LABELS) as LearningPace[]).map((p) => (
                <option key={p} value={p}>
                  {PACE_LABELS[p]}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 兴趣方向 */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          6. 兴趣方向
        </h3>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(profile?.interests ?? []).map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => removeInterest(i)}
              className="group inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
            >
              {t}
              <span className="text-slate-300 group-hover:text-rose-400">✕</span>
            </button>
          ))}
          {(!profile?.interests || profile.interests.length === 0) && (
            <span className="text-xs text-slate-400">暂无数据</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addInterest()}
            placeholder="添加兴趣…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          />
          <button
            type="button"
            onClick={addInterest}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  icon: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{label}</span>
        <span>{icon}</span>
      </div>
      <div className="mt-1 text-xl font-bold text-slate-800">
        {value}
        {suffix && <span className="text-sm text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ActivityHeatmap({ activity }: { activity: Record<string, number> }) {
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: activity[key] || 0 });
  }

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  function color(count: number): string {
    if (count === 0) return "bg-slate-100";
    if (count === 1) return "bg-emerald-200";
    if (count === 2) return "bg-emerald-400";
    return "bg-emerald-600";
  }

  return (
    <div className="flex gap-1 overflow-x-auto">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} 次活动`}
              className={`h-3 w-3 rounded-sm ${color(day.count)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
