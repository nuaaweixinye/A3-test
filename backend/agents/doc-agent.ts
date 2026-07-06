// 智能体 · 文档生成 Agent（DocAgent）
// 赛题必做功能 2：多智能体协同的资源生成 —— "课程讲解文档"类型。
// 经 runResourceAgent 完成检索约束 + 流式生成 + 引用标注。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/backend/agents/resource-runner";
import type { Emitter } from "@/backend/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/backend/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份 Markdown 格式的"讲解文档"，结构包含：一级标题、学习目标、核心概念（含表格/列表）、典型示例（如适用）、复杂度分析、易错提醒、小结。不要输出无关寒暄。`;

export async function generateDoc(
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

请输出一份完整的 Markdown 讲解文档。`,
  });
}
