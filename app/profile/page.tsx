"use client";

import { useState } from "react";
import Link from "next/link";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { ProfileRadar } from "@/frontend/components/profile/ProfileRadar";
import { showToast } from "@/frontend/components/ui/Toast";
import type { CognitiveStyle, LearningGoal, LearningPace, StudentProfile } from "@/backend/types";

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

export default function ProfilePage() {
  const profile = useLearningStore((s) => s.profile);
  const setProfile = useLearningStore((s) => s.setProfile);
  const [newInterest, setNewInterest] = useState("");

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
    showToast("知识点已删除", "info");
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
    showToast("兴趣已添加", "success");
  }

  function removeInterest(idx: number) {
    if (!profile) return;
    setProfile({
      ...profile,
      interests: profile.interests.filter((_, i) => i !== idx),
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">学生学习画像</h1>
          <p className="text-sm text-slate-500">
            对话式自动抽取 · 6 个维度 · 可手动调整
          </p>
        </div>
        {!profile && (
          <Link
            href="/"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            去发起对话
          </Link>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">维度雷达</h2>
          <ProfileRadar profile={profile} />
        </section>

        <section className="space-y-3">
          {/* 知识基础水平 — 可编辑滑块 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-slate-700">1. 知识基础水平</h3>
              <span className="text-xs text-slate-400">拖动滑块调整</span>
            </div>
            {profile && Object.keys(profile.knowledge_level).length > 0 ? (
              <div className="space-y-2.5">
                {Object.entries(profile.knowledge_level).map(([k, v]) => (
                  <div key={k} className="group flex items-center gap-2">
                    <span className="w-20 shrink-0 truncate text-xs text-slate-600">{k}</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={v}
                      onChange={(e) => updateKnowledge(k, Number(e.target.value))}
                      className="h-1.5 flex-1 accent-blue-600"
                    />
                    <span className="w-8 text-right text-xs tabular-nums text-slate-500">{v}</span>
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
          </div>

          {/* 认知学习风格 — 可切换 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">2. 认知学习风格</h3>
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
            <h3 className="mb-2 text-sm font-semibold text-slate-700">3. 易错点偏好</h3>
            <div className="flex flex-wrap gap-1.5">
              {(profile?.error_patterns ?? []).map((t, i) => (
                <span
                  key={i}
                  className="rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-600"
                >
                  {t}
                </span>
              ))}
              {(!profile?.error_patterns || profile.error_patterns.length === 0) && (
                <span className="text-xs text-slate-400">暂无数据</span>
              )}
            </div>
          </div>

          {/* 学习目标 + 节奏 — 可切换 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">4. 学习目标</h3>
              {profile && (
                <select
                  value={profile.learning_goal}
                  onChange={(e) => update({ learning_goal: e.target.value as LearningGoal })}
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">5. 学习节奏</h3>
              {profile && (
                <select
                  value={profile.learning_pace}
                  onChange={(e) => update({ learning_pace: e.target.value as LearningPace })}
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

          {/* 兴趣方向 — 可增删 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">6. 兴趣方向</h3>
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
        </section>
      </div>
    </div>
  );
}
