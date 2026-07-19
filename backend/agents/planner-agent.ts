import { callSpark, extractJson, type ChatMsg } from "@/backend/ai/spark";
import { formatContext, searchKnowledge } from "@/backend/knowledge/retriever";
import type {
  LearningPath,
  ResourceTask,
  ResourceType,
  StudentProfile,
} from "@/backend/types";

const SYSTEM_PROMPT = `你是一名学习路径规划专家。请根据学生画像、学习需求和课程知识库，规划一条科学、动态的个性化学习路径。

你只能输出严格 JSON，不要 Markdown 代码块，不要解释。JSON 结构如下：
{
  "path_title": "路径标题",
  "estimated_time": "例如 约1.5小时",
  "primary_topic": "本次聚焦的核心主题",
  "resource_tasks": [
    { "type": "design|doc|quiz|mindmap|video|code|reading", "topic": "具体主题", "reason": "为什么需要" }
  ],
  "steps": [
    {
      "step": 1,
      "title": "步骤标题",
      "description": "本步骤要做什么、为什么",
      "resource_tasks": [
        { "type": "design|doc|quiz|mindmap|video|code|reading", "topic": "具体主题", "reason": "为什么需要" }
      ],
      "estimated_minutes": 30
    }
  ]
}

规则：
1. primary_topic 要贴合学生最迫切的学习需求。
2. 顶层 resource_tasks 必须覆盖 7 类资源：design、doc、quiz、mindmap、video、code、reading。
3. 路径 steps 由浅入深，建议 3 到 5 步。
4. 根据认知风格调整资源侧重：visual 多用 mindmap/video，auditory 多用 video，kinesthetic 多用 code/quiz，reading 多用 doc/reading。
5. 学习目标 exam 侧重 quiz，project 侧重 code/design，research 侧重 reading/doc。`;

export interface PlanResult {
  path: LearningPath;
  primaryTopic: string;
  resourceTasks: ResourceTask[];
}

const ALL_TYPES: ResourceType[] = [
  "design",
  "doc",
  "quiz",
  "mindmap",
  "video",
  "code",
  "reading",
];

export async function planPath(
  profile: StudentProfile,
  request: string,
): Promise<PlanResult> {
  const chunks = await searchKnowledge(request, 6);
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

请输出 JSON，并确保顶层 resource_tasks 覆盖 7 类资源。`;

  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const raw = await callSpark({ messages, stage: "planner", temperature: 0.5 });
  const parsed = extractJson<PlannerOutput>(raw);
  const primaryTopic =
    (parsed?.primary_topic && String(parsed.primary_topic).trim()) ||
    request.slice(0, 30) ||
    "综合学习";
  const resourceTasks = ensureAllTypes(parsed?.resource_tasks, primaryTopic);
  const path = normalizePath(parsed, resourceTasks);

  return { path, primaryTopic, resourceTasks };
}

interface PlannerOutput {
  path_title?: string;
  estimated_time?: string;
  primary_topic?: string;
  resource_tasks?: ResourceTask[];
  steps?: LearningPath["steps"];
}

function ensureAllTypes(
  tasks: ResourceTask[] | undefined,
  primaryTopic: string,
): ResourceTask[] {
  const list = Array.isArray(tasks) ? tasks.filter(isValidTask) : [];
  const byType = new Map<ResourceType, ResourceTask>();

  for (const task of list) {
    if (!byType.has(task.type)) byType.set(task.type, task);
  }

  for (const type of ALL_TYPES) {
    if (!byType.has(type)) {
      byType.set(type, {
        type,
        topic: primaryTopic,
        reason: defaultReason(type),
      });
    }
  }

  return ALL_TYPES.map((type) => byType.get(type)!);
}

function normalizePath(
  output: PlannerOutput | null | undefined,
  fallbackTasks: ResourceTask[],
): LearningPath {
  const steps = Array.isArray(output?.steps) ? output.steps : [];
  const normalizedSteps = steps.length > 0 ? steps : buildFallbackSteps(fallbackTasks);

  return {
    path_title: output?.path_title || "个性化学习路径",
    estimated_time: output?.estimated_time || "约 1 小时",
    steps: normalizedSteps.map((step, index) => ({
      step: index + 1,
      title: step.title || `步骤 ${index + 1}`,
      description: step.description || "",
      resource_tasks: Array.isArray(step.resource_tasks)
        ? step.resource_tasks.filter(isValidTask)
        : [],
      estimated_minutes: Number(step.estimated_minutes) || 30,
    })),
  };
}

function buildFallbackSteps(tasks: ResourceTask[]): LearningPath["steps"] {
  return [
    {
      step: 1,
      title: "明确目标与资源方案",
      description: "先阅读资源设计方案，了解本轮学习目标、资源组合和使用顺序。",
      resource_tasks: tasks.filter((task) => ["design", "doc", "mindmap"].includes(task.type)),
      estimated_minutes: 25,
    },
    {
      step: 2,
      title: "理解核心概念",
      description: "结合讲解文档、思维导图和教学视频建立知识框架。",
      resource_tasks: tasks.filter((task) => ["doc", "mindmap", "video"].includes(task.type)),
      estimated_minutes: 35,
    },
    {
      step: 3,
      title: "练习与实践巩固",
      description: "通过题库、代码实操和拓展阅读完成迁移应用。",
      resource_tasks: tasks.filter((task) => ["quiz", "code", "reading"].includes(task.type)),
      estimated_minutes: 40,
    },
  ];
}

function isValidTask(task: ResourceTask): boolean {
  return ALL_TYPES.includes(task.type) && Boolean(task.topic?.trim());
}

function defaultReason(type: ResourceType): string {
  const reasons: Record<ResourceType, string> = {
    design: "用于明确资源组合、PPT 结构和学习活动安排",
    doc: "用于系统讲解核心概念",
    quiz: "用于检测掌握度和暴露易错点",
    mindmap: "用于建立知识结构",
    video: "用于多模态理解和动态演示",
    code: "用于实践迁移和动手巩固",
    reading: "用于拓展视野和补充背景",
  };
  return reasons[type];
}
