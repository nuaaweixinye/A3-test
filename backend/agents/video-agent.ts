// 智能体 · 教学视频 Agent（VideoAgent）
// 生成分镜脚本（旁白 + 画面 + 时长）。配音由前端用浏览器内置语音占位播放，
// 后续接入讯飞 TTS 后替换为真实配音（加分项 ④ 智能辅导 同源能力）。

import {
  runResourceAgent,
  ANTI_HALLUCINATION_RULES,
  buildPromptHead,
} from "@/backend/agents/resource-runner";
import type { Emitter } from "@/backend/agents/resource-runner";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/backend/types";

const SYSTEM_PROMPT = `${ANTI_HALLUCINATION_RULES}

本次任务：生成一份"教学视频分镜脚本"，包含 3~5 个分镜。每个分镜为二级标题，格式严格如下：

## 分镜 N（约Xs）
- **旁白**：可直接朗读的连贯解说（中文，口语化，避免特殊符号）
- **画面**：该分镜的画面描述

\`\`\`svg
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
  <style>
    .box { animation: fadeUp 0.6s ease-out both; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .arrow { animation: drawIn 0.5s ease-out 0.3s both; }
    @keyframes drawIn { from { opacity: 0; } to { opacity: 1; } }
  </style>
  <rect x="10" y="60" width="50" height="50" rx="4" fill="#3b82f6" class="box"/>
  <text x="35" y="90" text-anchor="middle" fill="white" font-size="18">3</text>
</svg>
\`\`\`

SVG 要求（务必遵守）：
1. viewBox 固定为 "0 0 400 200"，xmlns 为 "http://www.w3.org/2000/svg"
2. 必须包含 <style> 内的 CSS @keyframes 动画（淡入/移动/变色等教学动效）
3. 用 <rect> 表示数组/栈元素、<line>+<polygon> 表示箭头/指针、<circle> 表示树的节点、<text> 标注数值
4. 配色：蓝 #3b82f6、绿 #10b981、橙 #f59e0b、红 #ef4444、灰 #94a3b8
5. 只输出纯 <svg>...</svg>，不要 <html>、<body>、不要解释文字
6. 每个分镜的 SVG 要体现该步骤的关键变化（如交换、插入、删除）

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
