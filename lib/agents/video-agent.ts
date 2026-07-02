// 智能体 · 教学视频 Agent（VideoAgent）
// 生成分镜脚本（旁白 + 画面 + 时长）。配音由前端用浏览器内置语音占位播放，
// 后续接入讯飞 TTS 后替换为真实配音（加分项 ④ 智能辅导 同源能力）。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/lib/agents/resource-runner";
import type { Emitter } from "@/lib/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/lib/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份 Markdown 格式的"教学视频分镜脚本"。设计 3~5 个分镜，每个分镜为一个二级标题：
## 分镜 N（约Xs）
随后两行：
- **旁白**：可直接朗读的连贯解说（中文，口语化，避免特殊符号）
- **画面**：该分镜的画面/动画描述
旁白总时长控制在 60~90 秒。不要输出无关寒暄。`;

export async function generateVideo(
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

请输出一份 Markdown 教学视频分镜脚本。`,
  });
}
