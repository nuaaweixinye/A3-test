import { nanoid } from "nanoid";
import { streamSpark, type ChatMsg, type Stage } from "@/backend/ai/spark";
import { getAgentConfig } from "@/backend/agents/registry";
import { factCheck } from "@/backend/knowledge/fact-check";
import {
  formatContext,
  searchKnowledge,
  type KnowledgeChunk,
} from "@/backend/knowledge/retriever";
import { ANTI_HALLUCINATION } from "@/backend/prompts/snippets";
import type {
  AgentEvent,
  GeneratedResource,
  ResourceTask,
  ResourceType,
  StudentProfile,
} from "@/backend/types";

export { ANTI_HALLUCINATION as ANTI_HALLUCINATION_RULES };

export type Emitter = (event: AgentEvent) => void;

export interface AgentContextEntry {
  agentType: ResourceType;
  keyPoints: string[];
  flags: string[];
}

export interface RunResourceOptions {
  profile: StudentProfile;
  task: ResourceTask;
  emit?: Emitter;
  temperature?: number;
  agentContext?: Record<string, AgentContextEntry>;
  systemPrompt?: string;
  buildUserPrompt?: (ctx: {
    task: ResourceTask;
    profile: StudentProfile;
    context: string;
    agentContext: string;
  }) => string;
}

interface PromptModule {
  SYSTEM_PROMPT: string;
  buildUserPrompt: (params: {
    topic: string;
    profile: string;
    context: string;
    agentContext: string;
  }) => string;
}

export function formatAgentContext(
  entries: Record<string, AgentContextEntry>,
): string {
  const list = Object.values(entries);
  if (list.length === 0) return "";
  return list
    .map((entry) => {
      const flags = entry.flags.length ? `；标记：${entry.flags.join("、")}` : "";
      return `【${entry.agentType}】关键知识点：${entry.keyPoints.join("、")}${flags}`;
    })
    .join("\n");
}

export function extractAgentContext(
  agentType: ResourceType,
  content: string,
): AgentContextEntry {
  const headings = content.match(/^##\s+(.+)$/gm);
  const keyPoints = (headings ?? [])
    .map((heading) => heading.replace(/^##\s+/, "").replace(/[`*#]/g, "").trim())
    .filter((heading) => heading.length > 0 && heading.length < 40)
    .slice(0, 6);

  const flags: string[] = [];
  if (/易错|误区|注意|警告|陷阱/.test(content)) flags.push("含易错点");
  if (/重点|核心|关键/.test(content)) flags.push("含重点内容");
  if (/AI\s*基于知识库补全|参考：AI/.test(content)) flags.push("含 AI 补全");

  return { agentType, keyPoints, flags };
}

export function buildPromptHead(opts: {
  task: ResourceTask;
  profile: StudentProfile;
  context: string;
}): string {
  const { task, profile, context } = opts;
  return `【主题】${task.topic}
${task.reason ? `【生成理由】${task.reason}` : ""}

【学生画像】${JSON.stringify(profile)}

【知识库内容】
"""
${context}
"""`;
}

export async function runResourceAgent(
  opts: RunResourceOptions,
): Promise<GeneratedResource> {
  const config = getAgentConfig(opts.task.type);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.retryCount; attempt++) {
    try {
      return await runOnce(opts, config.timeout);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const canRetry = attempt < config.retryCount && isRetryableError(lastError);
      if (!canRetry) break;

      opts.emit?.({
        type: "status",
        agent: opts.task.type,
        message: `模型暂时繁忙，正在第 ${attempt + 1} 次自动重试...`,
      });
      await delay(Math.min(3000 * 2 ** attempt, 15_000));
    }
  }

  const resource: GeneratedResource = {
    id: nanoid(),
    type: opts.task.type,
    title: opts.task.topic,
    topic: opts.task.topic,
    content: `> 生成失败：${friendlyResourceError(lastError)}
>
> 系统已进行自动重试。请检查模型接口、网络连接、讯飞 QPS 配额，或稍后重新生成该资源。`,
    sources: [],
    fact_check: { score: 0, flagged: ["生成失败"], checked: 0 },
    created_at: new Date().toISOString(),
  };
  opts.emit?.({ type: "resource", resource });
  return resource;
}

async function runOnce(
  opts: RunResourceOptions,
  timeoutMs: number,
): Promise<GeneratedResource> {
  const { task, profile, emit, agentContext } = opts;
  const promptMod = await loadPromptModule(task.type);
  const chunks = await searchKnowledge(task.topic, 5);
  const { context, sources, usedSupplement } = await buildContextWithSupplement({
    task,
    profile,
    chunks,
    emit,
  });
  const id = nanoid();
  const agentContextText = agentContext ? formatAgentContext(agentContext) : "";
  const systemPrompt = opts.systemPrompt ?? promptMod.SYSTEM_PROMPT;
  const buildUserPrompt = opts.buildUserPrompt ?? defaultBuildUserPrompt(promptMod);

  emit?.({
    type: "resource_start",
    id,
    resType: task.type,
    title: task.topic,
    topic: task.topic,
  });

  const messages: ChatMsg[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: buildUserPrompt({
        task,
        profile,
        context,
        agentContext: agentContextText,
      }),
    },
  ];

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  let content = "";

  try {
    for await (const delta of streamSpark({
      messages,
      stage: task.type as Stage,
      temperature: opts.temperature ?? getAgentConfig(task.type).temperature,
      signal: abortController.signal,
    })) {
      content += delta;
      emit?.({ type: "resource_delta", id, text: delta });
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const factCheckResult = await factCheck(content, task.topic);
  const summary = extractAgentContext(task.type, content);
  const resource: GeneratedResource = {
    id,
    type: task.type,
    title: task.topic,
    topic: task.topic,
    content,
    sources,
    fact_check: usedSupplement
      ? {
          ...factCheckResult,
          flagged: [...factCheckResult.flagged, "部分内容使用 AI 基于知识库补全"],
        }
      : factCheckResult,
    created_at: new Date().toISOString(),
  };

  emit?.({
    type: "resource",
    resource,
    ...{ agentContext: summary },
  } as AgentEvent);
  return resource;
}

function defaultBuildUserPrompt(promptMod: PromptModule) {
  return (ctx: {
    task: ResourceTask;
    profile: StudentProfile;
    context: string;
    agentContext: string;
  }) =>
    promptMod.buildUserPrompt({
      topic: ctx.task.topic,
      profile: JSON.stringify(ctx.profile),
      context: ctx.context,
      agentContext: ctx.agentContext,
    });
}

async function buildContextWithSupplement(opts: {
  task: ResourceTask;
  profile: StudentProfile;
  chunks: KnowledgeChunk[];
  emit?: Emitter;
}): Promise<{ context: string; sources: string[]; usedSupplement: boolean }> {
  const knowledgeContext = formatContext(opts.chunks);
  const sources = Array.from(new Set(opts.chunks.map((chunk) => chunk.source)));
  if (!isKnowledgeInsufficient(opts.chunks)) {
    return { context: knowledgeContext, sources, usedSupplement: false };
  }

  opts.emit?.({
    type: "status",
    agent: opts.task.type,
    message: "知识库内容不足，将由 AI 基于提示词和已有知识库进行补全生成...",
  });

  return {
    context: `${knowledgeContext}

---

【知识库完整性提示】
当前知识库内容可能不足。请基于“资源生成提示词 + 已有知识库内容”完成生成：
1. 知识库已有的概念、术语、事实和数据必须优先采用，并标注知识库来源。
2. 如需补全缺失的前置概念、步骤解释、类比或学习建议，只能围绕当前主题和已有知识库展开。
3. 补全部分必须标注“（参考：AI 基于知识库补全）”。
4. 不要编造具体来源、页码、实验数据、政策规则或知识库中没有支撑的结论。
5. 如果资料不足以确定某个关键事实，请写“（当前资料中暂无此内容）”。`,
    sources: [...sources, "AI 基于知识库补全"],
    usedSupplement: true,
  };
}

function isKnowledgeInsufficient(chunks: KnowledgeChunk[]): boolean {
  if (chunks.length === 0) return true;
  const totalChars = chunks.reduce((sum, chunk) => sum + chunk.text.trim().length, 0);
  if (totalChars < 600) return true;
  const highConfidenceChunks = chunks.filter(
    (chunk) => chunk.score === undefined || chunk.score >= 0.35,
  );
  return highConfidenceChunks.length < 2;
}

async function loadPromptModule(type: ResourceType): Promise<PromptModule> {
  switch (type) {
    case "design":
      return (await import("@/backend/prompts/design")) as unknown as PromptModule;
    case "doc":
      return (await import("@/backend/prompts/doc")) as unknown as PromptModule;
    case "quiz":
      return (await import("@/backend/prompts/quiz")) as unknown as PromptModule;
    case "mindmap":
      return (await import("@/backend/prompts/mindmap")) as unknown as PromptModule;
    case "video":
      return (await import("@/backend/prompts/video")) as unknown as PromptModule;
    case "code":
      return (await import("@/backend/prompts/code")) as unknown as PromptModule;
    case "reading":
      return (await import("@/backend/prompts/reading")) as unknown as PromptModule;
    default:
      throw new Error(`Unknown resource type: ${type}`);
  }
}

function isRetryableError(error: Error): boolean {
  return /fetch|timeout|abort|network|econnreset|socket|11202|qps|overflow|rate/i.test(
    error.message,
  );
}

function friendlyResourceError(error: Error | null): string {
  const message = error?.message ?? "未知错误";
  if (/11202|qps|overflow/i.test(message)) {
    return "星火接口限流：当前 AppID 的 QPS 额度不足，系统已自动排队重试但仍未成功。";
  }
  return message;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
