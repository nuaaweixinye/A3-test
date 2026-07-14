// 资源生成 Agent 共享运行器
// 统一处理：RAG 检索（防幻觉第 1 层）→ 星火流式生成 → 通过 emit 推送
//   resource_start / resource_delta / resource 事件到 SSE 通道。
// 各具体资源 Agent 只需提供自己的 System Prompt 与 user prompt 构造逻辑。

import { streamSpark, type ChatMsg, type Stage } from "@/backend/ai/spark";
import { searchKnowledge, formatContext } from "@/backend/knowledge/retriever";
import { factCheck } from "@/backend/knowledge/fact-check";
import type {
  AgentEvent,
  GeneratedResource,
  ResourceTask,
  StudentProfile,
} from "@/backend/types";
import { nanoid } from "nanoid";

/** 事件发射器：把 Agent 事件推送到 SSE 通道 */
export type Emitter = (event: AgentEvent) => void;

/** 所有资源 Agent 共享的防幻觉与个性化规则（第 2 层 Prompt 约束 + 第 4 层引用要求） */
export const ANTI_HALLUCINATION_RULES = `你是一名高校"数据结构与算法"课程的内容生成助教，严格遵循：
1.【知识来源】仅基于提供的【知识库内容】生成，不得编造知识库中不存在的信息。
2.【不确定声明】若信息不足以覆盖某点，请写明：「（当前知识库中暂无此内容，建议查阅教材补充）」。
3.【引用来源】关键结论后标注来源，格式：「（参考：知识库 · 来源名）」。
4.【关键内容核查】数值、复杂度、代码须与知识库一致，不得改动。
5.【个性化】结合学生画像调整深度与举例方式。`;

export interface RunResourceOptions {
  profile: StudentProfile;
  task: ResourceTask;
  systemPrompt: string;
  /** 构造给大模型的 user prompt；ctx 含知识库上下文等 */
  buildUserPrompt: (ctx: {
    task: ResourceTask;
    profile: StudentProfile;
    context: string;
  }) => string;
  emit?: Emitter;
  temperature?: number;
}

/** 运行一个资源 Agent：检索 → 流式生成 → 推送事件，返回最终资源对象 */
export async function runResourceAgent(
  opts: RunResourceOptions,
): Promise<GeneratedResource> {
  const { task, profile, systemPrompt, buildUserPrompt, emit, temperature = 0.6 } = opts;

  const chunks = await searchKnowledge(task.topic, 5);
  const context = formatContext(chunks);
  const sources = Array.from(new Set(chunks.map((c) => c.source)));
  const id = nanoid();

  emit?.({
    type: "resource_start",
    id,
    resType: task.type,
    title: task.topic,
    topic: task.topic,
  });

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: buildUserPrompt({ task, profile, context }) },
  ];

  let content = "";
  for await (const delta of streamSpark({
    messages,
    stage: task.type as Stage,
    temperature,
  })) {
    content += delta;
    emit?.({ type: "resource_delta", id, text: delta });
  }

  // 防幻觉第 3 层：生成完成后事实核查（回查知识库交叉验证）
  const factCheckResult = await factCheck(content, task.topic);

  const resource: GeneratedResource = {
    id,
    type: task.type,
    title: task.topic,
    topic: task.topic,
    content,
    sources,
    fact_check: factCheckResult,
    created_at: new Date().toISOString(),
  };
  emit?.({ type: "resource", resource });
  return resource;
}

/** 构造通用的 user prompt 头部（主题/画像/知识库） */
export function buildPromptHead(opts: {
  task: ResourceTask;
  profile: StudentProfile;
  context: string;
}): string {
  const { task, profile, context } = opts;
  return `【主题】${task.topic}
${task.reason ? `【生成理由】${task.reason}` : ""}

【学生画像】
${JSON.stringify(profile)}

【知识库内容】（务必以此为主要事实来源）
"""
${context}
"""`;
}
