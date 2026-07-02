// 智能体 · 代码实操 Agent（CodeAgent）
// 生成可运行示例代码 + 注释 + 复杂度分析 + 易错点。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/lib/agents/resource-runner";
import type { Emitter } from "@/lib/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/lib/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份 Markdown 格式的"代码实操案例"。用 \`\`\`python 代码块给出一个聚焦主题的、可直接运行的示例，代码带中文注释；随后给出"复杂度分析"与"易错点"小节。不要输出无关寒暄。`;

export async function generateCode(
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

请输出一份 Markdown 代码实操案例。`,
  });
}
