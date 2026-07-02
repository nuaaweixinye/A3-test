// 智能体 · 思维导图 Agent（MindmapAgent）
// 生成层次化的知识点思维导图，用 Markdown 嵌套列表表达层级。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/lib/agents/resource-runner";
import type { Emitter } from "@/lib/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/lib/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份 Markdown 格式的"知识点思维导图"。用缩进的"- "列表表达层级结构，根节点为一级标题（即主题）。层级 3~4 层，覆盖定义、核心操作、复杂度、变体、应用、易错点等分支。不要输出无关寒暄。`;

export async function generateMindmap(
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

请输出一份 Markdown 思维导图（嵌套列表）。`,
  });
}
