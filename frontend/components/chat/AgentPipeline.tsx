"use client";

import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { ResourceType } from "@/backend/types";

const RESOURCE_AGENTS: { type: ResourceType; icon: string; label: string }[] = [
  { type: "doc", icon: "📄", label: "讲解文档" },
  { type: "quiz", icon: "❓", label: "练习题库" },
  { type: "mindmap", icon: "🧠", label: "思维导图" },
  { type: "video", icon: "🎬", label: "教学视频" },
  { type: "code", icon: "💻", label: "代码实操" },
  { type: "reading", icon: "📚", label: "拓展阅读" },
];

type AgentState = "idle" | "running" | "done";

function getStateStyle(state: AgentState) {
  switch (state) {
    case "done":
      return "border-emerald-200 bg-emerald-50";
    case "running":
      return "border-blue-300 bg-blue-50";
    default:
      return "border-slate-200 bg-white";
  }
}

function getStateIcon(state: AgentState) {
  switch (state) {
    case "done":
      return <span className="text-emerald-600">✓</span>;
    case "running":
      return (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
      );
    default:
      return <span className="text-slate-300">○</span>;
  }
}

export function AgentPipeline() {
  const profile = useLearningStore((s) => s.profile);
  const path = useLearningStore((s) => s.path);
  const resourceCards = useLearningStore((s) => s.resourceCards);
  const resourceOrder = useLearningStore((s) => s.resourceOrder);
  const running = useLearningStore((s) => s.running);
  const error = useLearningStore((s) => s.error);

  const cards = resourceOrder
    .map((id) => resourceCards[id])
    .filter(Boolean);

  const cardsByType = new Map<ResourceType, (typeof cards)[0]>();
  for (const c of cards) {
    cardsByType.set(c.resType, c);
  }

  const profileState: AgentState = profile ? "done" : running ? "running" : "idle";
  const plannerState: AgentState = path ? "done" : profile ? "running" : "idle";

  function resState(type: ResourceType): AgentState {
    const card = cardsByType.get(type);
    if (card?.done) return "done";
    if (card) return "running";
    if (path) return "running";
    return "idle";
  }

  const doneCount = cards.filter((c) => c.done).length;

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">智能体流水线</h2>
        {running ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            运行中
          </span>
        ) : doneCount > 0 ? (
          <span className="text-xs text-emerald-600">已完成 {doneCount} 个资源</span>
        ) : (
          <span className="text-xs text-slate-400">待命</span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          ✕ {error}
        </div>
      )}

      <div className="space-y-2">
        <AgentRow
          icon="🔍"
          label="画像 Agent"
          desc={
            profile
              ? `${Object.keys(profile.knowledge_level).length} 个知识点已画像`
              : undefined
          }
          state={profileState}
        />

        <Connector active={plannerState === "running"} />

        <AgentRow
          icon="📋"
          label="规划 Agent"
          desc={
            path ? `${path.steps.length} 步学习路径` : undefined
          }
          state={plannerState}
        />

        <Connector active={!!path && !cards.every((c) => c.done)} />

        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            6 资源生成（并行）
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {RESOURCE_AGENTS.map((a) => (
              <div
                key={a.type}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${getStateStyle(
                  resState(a.type),
                )}`}
              >
                <span>{a.icon}</span>
                <span className="flex-1 truncate text-slate-600">{a.label}</span>
                {getStateIcon(resState(a.type))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentRow({
  icon,
  label,
  desc,
  state,
}: {
  icon: string;
  label: string;
  desc?: string;
  state: AgentState;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition ${getStateStyle(
        state,
      )}`}
    >
      <span className="text-lg">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="text-xs text-slate-500">{desc}</p>}
      </div>
      {getStateIcon(state)}
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center">
      <span
        className={`h-4 w-0.5 rounded-full ${
          active ? "bg-blue-300" : "bg-slate-200"
        }`}
      />
    </div>
  );
}
