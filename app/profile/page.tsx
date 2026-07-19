"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ProfileRadar } from "@/frontend/components/profile/ProfileRadar";
import { showToast } from "@/frontend/components/ui/Toast";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type {
  CognitiveStyle,
  LearningGoal,
  LearningPace,
  StudentProfile,
} from "@/backend/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const GOAL_LABELS: Record<LearningGoal, string> = {
  exam: "考试备考",
  project: "项目实战",
  research: "学术研究",
  interest: "兴趣学习",
};

const PACE_LABELS: Record<LearningPace, string> = {
  fast: "快速推进",
  medium: "稳步学习",
  slow: "慢速巩固",
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

export default function ProfilePage() {
  const profile = useLearningStore((state) => state.profile);
  const setProfile = useLearningStore((state) => state.setProfile);
  const [newInterest, setNewInterest] = useState("");
  const [newError, setNewError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const insights = useMemo(() => buildProfileInsights(profile), [profile]);

  const fetchStats = useCallback(() => {
    fetch("/api/profile/stats")
      .then((response) => response.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  function update(patch: Partial<StudentProfile>) {
    if (!profile) return;
    setProfile({ ...profile, ...patch, updated_at: new Date().toISOString() });
    showToast("画像已更新", "success");
  }

  function updateKnowledge(key: string, value: number) {
    if (!profile) return;
    update({
      knowledge_level: { ...profile.knowledge_level, [key]: value },
    });
  }

  function removeKnowledge(key: string) {
    if (!profile) return;
    const next = { ...profile.knowledge_level };
    delete next[key];
    update({ knowledge_level: next });
  }

  function addInterest() {
    const value = newInterest.trim();
    if (!value || !profile) return;
    if (profile.interests.includes(value)) {
      showToast("该兴趣已存在", "error");
      return;
    }
    update({ interests: [...profile.interests, value].slice(0, 8) });
    setNewInterest("");
  }

  function removeInterest(index: number) {
    if (!profile) return;
    update({ interests: profile.interests.filter((_, i) => i !== index) });
  }

  function addErrorPattern() {
    const value = newError.trim();
    if (!value || !profile) return;
    if (profile.error_patterns.includes(value)) {
      showToast("该错因已存在", "error");
      return;
    }
    update({ error_patterns: [...profile.error_patterns, value].slice(0, 8) });
    setNewError("");
  }

  function removeErrorPattern(index: number) {
    if (!profile) return;
    update({ error_patterns: profile.error_patterns.filter((_, i) => i !== index) });
  }

  async function generateSuggestions() {
    setLoadingSuggestions(true);
    try {
      const response = await fetch("/api/profile/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await response.json();
      setSuggestions(data.suggestions || []);
    } catch {
      showToast("建议生成失败", "error");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
            Learner Profile
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">学生学习画像</h1>
          <p className="mt-1 text-sm text-slate-500">
            汇总知识掌握、认知偏好、目标节奏、错因模式和学习行为。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateSuggestions}
            disabled={loadingSuggestions || !profile}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-50"
          >
            {loadingSuggestions ? "生成中..." : "生成 AI 建议"}
          </button>
          {!profile && (
            <Link
              href="/"
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
            >
              发起学习对话
            </Link>
          )}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="画像完整度" value={insights.completeness} suffix="%" />
        <StatCard label="平均掌握度" value={insights.averageMastery} suffix="分" />
        <StatCard label="薄弱知识点" value={insights.weakTopics.length} />
        <StatCard label="连续活跃" value={stats?.streak ?? 0} suffix="天" />
      </section>

      {stats && (
        <section className="grid gap-3 sm:grid-cols-4">
          <MiniMetric label="学习会话" value={stats.totalSessions} />
          <MiniMetric label="生成资源" value={stats.totalResources} />
          <MiniMetric label="辅导对话" value={stats.totalTutorConvs} />
          <MiniMetric label="平均评估" value={`${stats.avgScore} 分`} />
        </section>
      )}

      {suggestions.length > 0 && (
        <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-violet-800">AI 个性化学习建议</h2>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700">
                <span className="mr-2 font-semibold text-violet-600">{index + 1}.</span>
                {suggestion}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">六维画像雷达</h2>
              <p className="mt-1 text-xs text-slate-500">
                用于判断当前学习状态是否均衡，以及下一轮资源生成的侧重点。
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
              {insights.summary}
            </span>
          </div>
          <ProfileRadar profile={profile} />
        </section>

        <aside className="space-y-4">
          <InsightPanel title="画像诊断">
            <InsightLine label="优势" value={insights.strength || "暂无明显优势"} tone="good" />
            <InsightLine label="短板" value={insights.risk || "暂无明显短板"} tone="warn" />
            <InsightLine label="策略" value={insights.strategy} tone="info" />
          </InsightPanel>

          {stats && (
            <InsightPanel title="学习活动">
              <ActivityHeatmap activity={stats.activity} />
              {stats.scoreHistory.length > 1 && (
                <ReactECharts
                  style={{ height: "150px", marginTop: 12 }}
                  option={{
                    tooltip: { trigger: "axis" },
                    grid: { left: 28, right: 12, top: 10, bottom: 24 },
                    xAxis: {
                      type: "category",
                      data: stats.scoreHistory.map((item) => formatShortDate(item.date)),
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
                        data: stats.scoreHistory.map((item) => item.score),
                        itemStyle: { color: "#2563eb" },
                        areaStyle: { opacity: 0.08 },
                        symbolSize: 5,
                      },
                    ],
                  }}
                />
              )}
            </InsightPanel>
          )}
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">知识掌握矩阵</h2>
            <p className="mt-1 text-xs text-slate-500">
              低于 60 的知识点会优先进入后续复习、题库和讲解视频。
            </p>
          </div>
          <div className="flex gap-2 text-[10px] text-slate-400">
            <Legend color="bg-rose-400" label="< 40" />
            <Legend color="bg-amber-400" label="40-69" />
            <Legend color="bg-emerald-400" label="70+" />
          </div>
        </div>

        {profile && Object.keys(profile.knowledge_level).length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(profile.knowledge_level).map(([key, value]) => (
              <KnowledgeRow
                key={key}
                name={key}
                value={value}
                onChange={(next) => updateKnowledge(key, next)}
                onRemove={() => removeKnowledge(key)}
              />
            ))}
          </div>
        ) : (
          <EmptyState text="暂无知识点数据，生成学习资源后会自动补全。" />
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <PreferencePanel title="认知学习风格">
          {profile && (
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(STYLE_LABELS) as CognitiveStyle[]).map((style) => (
                <ChoiceButton
                  key={style}
                  active={profile.cognitive_style === style}
                  label={STYLE_LABELS[style]}
                  onClick={() => update({ cognitive_style: style })}
                />
              ))}
            </div>
          )}
        </PreferencePanel>

        <PreferencePanel title="学习目标">
          {profile && (
            <select
              value={profile.learning_goal}
              onChange={(event) =>
                update({ learning_goal: event.target.value as LearningGoal })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              {(Object.keys(GOAL_LABELS) as LearningGoal[]).map((goal) => (
                <option key={goal} value={goal}>
                  {GOAL_LABELS[goal]}
                </option>
              ))}
            </select>
          )}
        </PreferencePanel>

        <PreferencePanel title="学习节奏">
          {profile && (
            <select
              value={profile.learning_pace}
              onChange={(event) =>
                update({ learning_pace: event.target.value as LearningPace })
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              {(Object.keys(PACE_LABELS) as LearningPace[]).map((pace) => (
                <option key={pace} value={pace}>
                  {PACE_LABELS[pace]}
                </option>
              ))}
            </select>
          )}
        </PreferencePanel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TagEditor
          title="易错模式"
          placeholder="添加易错点，例如 概念混淆"
          tags={profile?.error_patterns ?? []}
          value={newError}
          onValueChange={setNewError}
          onAdd={addErrorPattern}
          onRemove={removeErrorPattern}
          emptyText="暂无易错模式"
          tone="rose"
        />

        <TagEditor
          title="兴趣方向"
          placeholder="添加兴趣，例如 AI 应用"
          tags={profile?.interests ?? []}
          value={newInterest}
          onValueChange={setNewInterest}
          onAdd={addInterest}
          onRemove={removeInterest}
          emptyText="暂无兴趣方向"
          tone="blue"
        />
      </section>
    </div>
  );
}

function buildProfileInsights(profile: StudentProfile | null) {
  if (!profile) {
    return {
      completeness: 0,
      averageMastery: 0,
      weakTopics: [],
      summary: "等待画像",
      strength: "",
      risk: "",
      strategy: "先发起一次学习对话，让系统抽取基础画像。",
    };
  }

  const knowledgeEntries = Object.entries(profile.knowledge_level || {});
  const values = knowledgeEntries.map(([, value]) => value);
  const averageMastery = values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;
  const weakTopics = knowledgeEntries
    .filter(([, value]) => value < 60)
    .sort((a, b) => a[1] - b[1])
    .map(([key]) => key);
  const strongTopic = knowledgeEntries.sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  const filled = [
    values.length > 0,
    Boolean(profile.cognitive_style),
    profile.error_patterns.length > 0,
    Boolean(profile.learning_goal),
    Boolean(profile.learning_pace),
    profile.interests.length > 0,
  ].filter(Boolean).length;

  const completeness = Math.round((filled / 6) * 100);
  const strategy =
    weakTopics.length > 0
      ? `优先复习 ${weakTopics.slice(0, 2).join("、")}，搭配题库和讲解文档。`
      : `${STYLE_LABELS[profile.cognitive_style]}学习者，可继续提高任务难度。`;

  return {
    completeness,
    averageMastery,
    weakTopics,
    summary: completeness >= 80 ? "画像较完整" : "画像待补全",
    strength: strongTopic ? `${strongTopic} 掌握相对较好` : "",
    risk: weakTopics.length > 0 ? `${weakTopics.slice(0, 3).join("、")} 需要巩固` : "",
    strategy,
  };
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
        {suffix && <span className="ml-1 text-sm font-medium text-slate-400">{suffix}</span>}
      </p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-100 px-3 py-2">
      <p className="text-[10px] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function InsightPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function InsightLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "info";
}) {
  const toneClass = {
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
  }[tone];

  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] ${toneClass}`}>{label}</span>
      <span className="text-slate-700">{value}</span>
    </div>
  );
}

function KnowledgeRow({
  name,
  value,
  onChange,
  onRemove,
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-slate-700">{name}</span>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-10 rounded-full ${masteryColor(value)}`} />
          <span className="w-8 text-right text-xs tabular-nums text-slate-500">{value}</span>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-slate-300 opacity-0 transition hover:text-rose-500 group-hover:opacity-100"
          >
            删除
          </button>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full accent-blue-600"
      />
    </div>
  );
}

function PreferencePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

function ChoiceButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs transition ${
        active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function TagEditor({
  title,
  placeholder,
  tags,
  value,
  onValueChange,
  onAdd,
  onRemove,
  emptyText,
  tone,
}: {
  title: string;
  placeholder: string;
  tags: string[];
  value: string;
  onValueChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  emptyText: string;
  tone: "rose" | "blue";
}) {
  const tagClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
      : "bg-blue-50 text-blue-700 hover:bg-blue-100";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tags.length > 0 ? (
          tags.map((tag, index) => (
            <button
              key={`${tag}-${index}`}
              type="button"
              onClick={() => onRemove(index)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${tagClass}`}
            >
              {tag} · 删除
            </button>
          ))
        ) : (
          <span className="text-xs text-slate-400">{emptyText}</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onAdd()}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
        >
          添加
        </button>
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ActivityHeatmap({ activity }: { activity: Record<string, number> }) {
  const days: { date: string; count: number }[] = [];
  const today = new Date();

  for (let index = 83; index >= 0; index--) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    days.push({ date: key, count: activity[key] || 0 });
  }

  const weeks: Array<typeof days> = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="flex gap-1 overflow-x-auto">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="flex flex-col gap-1">
          {week.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.count} 次活动`}
              className={`h-3 w-3 rounded-sm ${activityColor(day.count)}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function masteryColor(value: number): string {
  if (value < 40) return "bg-rose-500";
  if (value < 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function activityColor(count: number): string {
  if (count === 0) return "bg-slate-100";
  if (count === 1) return "bg-emerald-200";
  if (count === 2) return "bg-emerald-400";
  return "bg-emerald-600";
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
