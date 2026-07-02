// 智能体 2：路径规划 Agent（PlannerAgent）
// 赛题必做功能 3：个性化学习路径规划与资源推送。
// 输出一条简短学习路径，并标注每步要生成的资源任务（doc/quiz/mindmap/video/code/reading）。
// 注：最小闭环阶段，本系统会实际"生成"其中第一个 doc 任务（见 doc-agent 与 graph）。

import { callSpark, extractJson, type ChatMsg } from "@/lib/ai/spark";
import { searchKnowledge, formatContext } from "@/lib/knowledge/retriever";
import type { LearningPath, ResourceTask, StudentProfile } from "@/lib/types";

const SYSTEM_PROMPT = `你是一名学习路径规划专家。根据学生画像、学习需求和课程知识库，规划一条科学、动态的个性化学习路径。
你只能输出严格的 JSON（不要 markdown 代码块、不要解释）。JSON 结构如下：
{
  "path_title": "路径标题",
  "estimated_time": "如 约2.5小时",
  "steps": [
    {
      "step": 1,
      "title": "步骤标题",
      "description": "本步骤要做什么、为什么",
      "resource_tasks": [
        { "type": "doc|quiz|mindmap|video|code|reading", "topic": "具体主题", "reason": "为何需要" }
      ],
      "estimated_minutes": 30
    }
  ]
}
规则：
1. 路径由浅入深，3~5 个步骤为宜。
2. 至少包含一个 type 为 "doc" 的资源任务，作为当前会优先生成的讲解文档。
3. 根据学生认知风格(cognitive_style)调整资源类型：visual 多 doc/mindmap，auditory 多 video，kinesthetic 多 code/quiz，reading 多 doc/reading。
4. 学习目标为 exam 时侧重 quiz；project 时侧重 code。`;

export interface PlanResult {
  path: LearningPath;
  /** 选定本次实际生成的首个 doc 任务 */
  docTask: ResourceTask;
}

export async function planPath(
  profile: StudentProfile,
  request: string,
): Promise<PlanResult> {
  const chunks = searchKnowledge(request, 6);
  const context = formatContext(chunks);

  const userPrompt = `学生画像：
${JSON.stringify(profile)}

知识库相关内容：
"""
${context}
"""

学习需求：
"""
${request}
"""

请输出个性化学习路径 JSON（仅 JSON），并在其中包含至少一个 "doc" 资源任务。`;

  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const raw = await callSpark({ messages, stage: "planner", temperature: 0.5 });
  const path = normalizePath(extractJson<LearningPath>(raw));

  // 选定首个 doc 任务作为本次实际生成的资源
  const docTask = pickDocTask(path, request);
  return { path, docTask };
}

function pickDocTask(path: LearningPath, fallbackTopic: string): ResourceTask {
  for (const step of path.steps) {
    for (const t of step.resource_tasks) {
      if (t.type === "doc") return { type: "doc", topic: t.topic, reason: t.reason };
    }
  }
  // 兜底：路径中无 doc 任务时，按需求文本构造一个
  return { type: "doc", topic: fallbackTopic.slice(0, 40) || "数据结构入门" };
}

function normalizePath(p: LearningPath): LearningPath {
  const steps = Array.isArray(p?.steps) ? p.steps : [];
  return {
    path_title: p?.path_title || "个性化学习路径",
    estimated_time: p?.estimated_time || "约 1 小时",
    steps: steps.map((s, i) => ({
      step: i + 1,
      title: s.title || `步骤 ${i + 1}`,
      description: s.description || "",
      resource_tasks: Array.isArray(s.resource_tasks) ? s.resource_tasks : [],
      estimated_minutes: Number(s.estimated_minutes) || 30,
    })),
  };
}
