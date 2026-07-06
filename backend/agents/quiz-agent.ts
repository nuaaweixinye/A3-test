// 智能体 · 题库生成 Agent（QuizAgent）
// 生成个性化练习题，含单选/填空/简答/编程，每题附答案与解析。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/backend/agents/resource-runner";
import type { Emitter } from "@/backend/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/backend/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份 Markdown 格式的"练习题库"，包含 4~6 道题，题型混合：
- 单选题（给出 A/B/C/D 选项）
- 填空题
- 简答题
- 编程题（如适用）
每道题后必须用引用块给出"答案"与"解析"，解析中标注知识库来源。不要输出无关寒暄。`;

export async function generateQuiz(
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

请输出一份 Markdown 练习题库。`,
  });
}
