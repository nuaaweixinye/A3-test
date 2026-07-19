"use client";

import { analyzeResourceQuality } from "@/frontend/lib/resource-quality";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import type { ResourceType } from "@/backend/types";

const RESOURCE_AGENTS: { type: ResourceType; icon: string; label: string }[] = [
  { type: "design", icon: "P", label: "资源设计/PPT" },
  { type: "doc", icon: "文", label: "讲解文档" },
  { type: "quiz", icon: "题", label: "练习题库" },
  { type: "mindmap", icon: "图", label: "思维导图" },
  { type: "video", icon: "视", label: "教学视频" },
  { type: "code", icon: "码", label: "代码实操" },
  { type: "reading", icon: "读", label: "拓展阅读" },
];

type AgentState = "idle" | "running" | "done" | "review";

export function AgentPipeline() {
  const profile = useLearningStore((state) => state.profile);
  const path = useLearningStore((state) => state.path);
  const resourceCards = useLearningStore((state) => state.resourceCards);
  const resourceOrder = useLearningStore((state) => state.resourceOrder);
  const running = useLearningStore((state) => state.running);
  const error = useLearningStore((state) => state.error);

  const cards = resourceOrder.map((id) => resourceCards[id]).filter(Boolean);
  const cardsByType = new Map<ResourceType, (typeof cards)[0]>();
  for (const card of cards) cardsByType.set(card.resType, card);

  const profileState: AgentState = profile ? "done" : running ? "running" : "idle";
  const plannerState: AgentState = path ? "done" : profile ? "running" : "idle";
  const doneCount = cards.filter((card) => card.done).length;
  const checkedCount = cards.filter((card) => card.crossCheck).length;
  const issueCount = cards.reduce(
    (sum, card) => sum + (card.crossCheck?.issues.length ?? 0),
    0,
  );
  const hasSynthesis = cards.some((card) => card.title.includes("学习导览"));
  const qualityAvg =
    cards.length > 0
      ? Math.round(
          cards.reduce((sum, card) => sum + analyzeResourceQuality(card).score, 0) /
            cards.length,
        )
      : 0;

  function resourceState(type: ResourceType): AgentState {
    const card = cardsByType.get(type);
    if (card?.crossCheck && !card.crossCheck.passed) return "review";
    if (card?.done) return "done";
    if (card) return "running";
    if (path) return "running";
    return "idle";
  }

  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">多智能体协同看板</h2>
          <p className="mt-1 text-xs text-slate-400">
            画像、规划、并行生成、交叉验证、综合导览、评估调优。
          </p>
        </div>
        {running ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-blue-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            运行中
          </span>
        ) : doneCount > 0 ? (
          <span className="text-xs text-emerald-600">质量均分 {qualityAvg}</span>
        ) : (
          <span className="text-xs text-slate-400">待命</span>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <AgentRow
          icon="像"
          label="ProfileAgent 画像构建"
          desc={
            profile
              ? `${Object.keys(profile.knowledge_level).length} 个知识点，6 维画像已更新`
              : "从自然语言对话抽取专业、目标、基础、风格、易错点和兴趣"
          }
          state={profileState}
        />
        <Connector active={plannerState === "running" || Boolean(path)} />
        <AgentRow
          icon="径"
          label="PlannerAgent 路径规划"
          desc={path ? `${path.steps.length} 步学习路径，分派 7 类资源任务` : "等待画像输入"}
          state={plannerState}
        />
        <Connector active={Boolean(path)} />

        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            7 个资源 Agent 并行生成
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {RESOURCE_AGENTS.map((agent) => {
              const card = cardsByType.get(agent.type);
              const quality = card ? analyzeResourceQuality(card) : null;
              const state = resourceState(agent.type);
              return (
                <div
                  key={agent.type}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${stateStyle(
                    state,
                  )}`}
                >
                  <span className="grid h-5 w-5 place-items-center rounded bg-slate-900 text-[10px] font-bold text-white">
                    {agent.icon}
                  </span>
                  <span className="flex-1 truncate text-slate-600">{agent.label}</span>
                  {quality && <span className="text-[10px] text-slate-400">{quality.score}</span>}
                  {stateIcon(state)}
                </div>
              );
            })}
          </div>
        </div>

        <Connector active={doneCount > 0} />
        <AgentRow
          icon="验"
          label="CrossCheckAgent 交叉验证"
          desc={
            checkedCount
              ? `已验证 ${checkedCount} 个资源，${issueCount} 个待关注点`
              : "等待资源生成完成"
          }
          state={checkedCount === 0 ? "idle" : issueCount > 0 ? "review" : "done"}
        />
        <Connector active={checkedCount > 0} />
        <AgentRow
          icon="导"
          label="SynthesisAgent 学习导览"
          desc={hasSynthesis ? "已整合资源、路径和学习建议" : "汇总各 Agent 产出"}
          state={hasSynthesis ? "done" : doneCount > 0 ? "running" : "idle"}
        />
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
    <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${stateStyle(state)}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        {desc && <p className="truncate text-xs text-slate-500">{desc}</p>}
      </div>
      {stateIcon(state)}
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex justify-center">
      <span className={`h-4 w-0.5 rounded-full ${active ? "bg-blue-300" : "bg-slate-200"}`} />
    </div>
  );
}

function stateStyle(state: AgentState): string {
  switch (state) {
    case "done":
      return "border-emerald-200 bg-emerald-50";
    case "running":
      return "border-blue-300 bg-blue-50";
    case "review":
      return "border-amber-200 bg-amber-50";
    default:
      return "border-slate-200 bg-white";
  }
}

function stateIcon(state: AgentState) {
  switch (state) {
    case "done":
      return <span className="text-xs font-bold text-emerald-600">完成</span>;
    case "running":
      return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />;
    case "review":
      return <span className="text-xs font-bold text-amber-600">复核</span>;
    default:
      return <span className="text-xs text-slate-300">待命</span>;
  }
}
