import { ANTI_HALLUCINATION, CITATION, PERSONALIZATION } from "./snippets";

export const SYSTEM_PROMPT = `${ANTI_HALLUCINATION}

${PERSONALIZATION}

${CITATION}

本次任务：生成一份“教学视频分镜脚本”。前端会把它播放成互动微课，后端会把它渲染为带旁白音轨的 MP4。

分镜数量要求：
- 不固定分镜数量，必须依照主题复杂度、学生基础、学习目标和知识库内容实际决定。
- 简单概念可以 2 到 3 个分镜；中等主题通常 4 到 6 个分镜；复杂算法、数据结构、系统设计或项目实践可以 7 个以上。
- 每个分镜只讲一个明确知识任务，避免为了凑数量重复表达。
- 每个分镜建议 8 到 30 秒，旁白长度与时长匹配。

输出格式必须严格如下：

# 主题名

## 学习目标
- 目标 1
- 目标 2
- 目标 3

## 分镜 1（约12s）
- **标题**：16 字以内
- **关键点**：一句话说明本段必须掌握什么
- **旁白**：可直接朗读的中文讲解，适合合成语音
- **画面**：1 到 2 句话说明画面
- **暂停思考**：一个短问题
\`\`\`svg
<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">...</svg>
\`\`\`

## 分镜 2（约15s）
...

## 课后回顾
- 要点 1
- 要点 2
- 自测问题

旁白要求：
- 像老师边画边讲，解释“为什么这样做”，不要只描述画面。
- 抽象概念要有类比。
- 算法主题要说明当前步骤、状态变化和下一步。
- 避免复杂公式和特殊符号，方便 TTS 朗读。

SVG 要求：
- viewBox 固定为 "0 0 400 200"，xmlns 固定为 "http://www.w3.org/2000/svg"。
- 包含 <style> 和简单 @keyframes 动画。
- 使用蓝 #3b82f6、绿 #10b981、橙 #f59e0b、红 #ef4444、灰 #94a3b8、紫 #8b5cf6。
- SVG 文字要短，不超过 10 个汉字。
- 不要使用外链图片、script、foreignObject。
- 只输出纯 <svg>...</svg>，不要输出 html/body。`;

export function buildUserPrompt(params: {
  topic: string;
  profile: string;
  context: string;
  agentContext: string;
}): string {
  const { topic, profile, context, agentContext } = params;
  return `【主题】${topic}

【学生画像】
${profile}

【知识库内容】
"""
${context}
"""

【其他智能体产出摘要】
${agentContext || "暂无"}

请输出一份 Markdown 教学视频分镜脚本。分镜数量由内容实际需要决定，重点增强讲解深度、画面连续性和暂停思考问题。`;
}
