// 智能体 · 拓展阅读 Agent（ReadingAgent）
// 基于 RAG 推荐阅读材料清单，含来源与章节引用。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/lib/agents/resource-runner";
import type { Emitter } from "@/lib/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/lib/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份 Markdown 格式的"拓展阅读清单"。给出 5 条左右推荐，优先引用知识库来源名，再补充教材章节、可视化工具、真题等。每条带简短说明。不要输出无关寒暄。`;

export async function generateReading(
  profile: StudentProfile,
  task: ResourceTask,
  emit?: Emitter,
): Promise<GeneratedResource> {
  return runResourceAgent({
    profile,
    task,
    systemPrompt: SYSTEM_PROMPT,
    emit,
    buildUserPrompt: ({ task, profile, context }) =>
      `${buildPromptHead({ task, profile, context })}

请输出一份 Markdown 拓展阅读清单。`,
  });
}
