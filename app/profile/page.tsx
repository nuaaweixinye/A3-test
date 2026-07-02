"use client";

import Link from "next/link";
import { useLearningStore } from "@/lib/store/useLearningStore";
import { ProfileRadar } from "@/components/profile/ProfileRadar";

export default function ProfilePage() {
  const profile = useLearningStore((s) => s.profile);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">学生学习画像</h1>
          <p className="text-sm text-slate-500">
            对话式自动抽取 · 6 个维度 · 随学随更新
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
          <DetailCard title="1. 知识基础水平" desc="知识点 → 0~100 掌握度">
            {profile && Object.keys(profile.knowledge_level).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(profile.knowledge_level).map(([k, v]) => (
                  <div key={k}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span>{k}</span>
                      <span className="text-slate-500">{v}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${v}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty />
            )}
          </DetailCard>

          <DetailCard title="2. 认知学习风格" desc={profile?.cognitive_style ?? "—"}>
            <Tags items={profile ? styleNote(profile.cognitive_style) : []} />
          </DetailCard>

          <DetailCard
            title="3. 易错点偏好"
            desc={`${profile?.error_patterns?.length ?? 0} 项`}
          >
            <Tags items={profile?.error_patterns ?? []} />
          </DetailCard>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MiniCard label="4. 学习目标" value={profile?.learning_goal ?? "—"} />
            <MiniCard label="5. 学习节奏" value={profile?.learning_pace ?? "—"} />
            <MiniCard
              label="6. 兴趣方向"
              value={`${profile?.interests?.length ?? 0} 项`}
            />
          </div>
          {profile && profile.interests.length > 0 && (
            <Tags items={profile.interests} />
          )}
        </section>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {desc && <span className="text-xs text-slate-400">{desc}</span>}
      </div>
      {children}
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold capitalize text-slate-700">
        {value}
      </div>
    </div>
  );
}

function Tags({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <Empty />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Empty() {
  return <span className="text-xs text-slate-400">暂无数据</span>;
}

function styleNote(style: string): string[] {
  const map: Record<string, string[]> = {
    visual: ["偏好图表/导图", "适合文档+图示"],
    auditory: ["偏好听讲", "适合视频/语音"],
    reading: ["偏好阅读", "适合文档+材料"],
    kinesthetic: ["偏好动手", "适合代码实操"],
  };
  return map[style] ?? [];
}
