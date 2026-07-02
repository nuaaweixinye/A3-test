// 智能体 3：文档生成 Agent（DocAgent）
// 赛题必做功能 2：多智能体协同的资源生成（本 Agent 负责"课程讲解文档"类型）。
// 关键：调用大模型前先检索知识库（防幻觉第 1 层），并在 Prompt 中强制约束 + 要求引用（第 2、4 层）。

import { streamSpark, type ChatMsg } from "@/lib/ai/spark";
import { searchKnowledge, formatContext } from "@/lib/knowledge/retriever";
import type { GeneratedResource, ResourceTask, StudentProfile } from "@/lib/types";
import { nanoid } from "nanoid";

const SYSTEM_PROMPT = `你是一名高校"数据结构与算法"课程的内容生成助教。严格遵循以下规则：

1.【知识来源】仅基于提供的【知识库内容】生成讲解文档，不得编造知识库中不存在的信息。
2.【不确定声明】若知识库中信息不足以覆盖某点，请明确写出：「（当前知识库中暂无此内容，建议查阅教材补充）」。
3.【引用来源】在关键定义、复杂度等结论后标注来源，格式：「（参考：知识库 · 来源名）」。
4.【关键内容核查】数值、复杂度、代码必须与知识库原文一致，不得改动。
5.【个性化】结合学生画像调整讲解深度与举例方式。

输出为 Markdown 格式的讲解文档，包含：一级标题、学习目标、核心概念（含表格/列表）、典型代码或示例（如适用）、易错提醒、小结。不要输出无关寒暄。`;

/** 流式生成讲解文档；每得到一段增量即通过 writer 回调推送（用于 SSE 流式呈现） */
export async function generateDoc(
  profile: StudentProfile,
  task: ResourceTask,
  writer?: (delta: string) => void,
): Promise<GeneratedResource> {
  const chunks = searchKnowledge(task.topic, 5);
  const context = formatContext(chunks);
  const sources = Array.from(new Set(chunks.map((c) => c.source)));

  const userPrompt = `请为学生生成一份讲解文档。

【主题】${task.topic}
${task.reason ? `【生成理由】${task.reason}` : ""}

【学生画像】
${JSON.stringify(profile)}

【知识库内容】（务必以此为主要事实来源）
"""
${context}
"""

请输出完整 Markdown 讲解文档。`;

  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let content = "";
  for await (const delta of streamSpark({ messages, stage: "doc", temperature: 0.6 })) {
    content += delta;
    writer?.(delta);
  }

  return {
    id: nanoid(),
    type: "doc",
    title: task.topic,
    topic: task.topic,
    content,
    sources,
    created_at: new Date().toISOString(),
  };
}
