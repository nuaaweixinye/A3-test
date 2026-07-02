// 讯飞星火大模型客户端 —— OpenAI 兼容接口
// 出题企业：科大讯飞（赛题硬性要求 AI 辅助工具须选用讯飞相关工具）
//
// 兼容端点：https://spark-api-open.xf-yun.com/v1/chat/completions
// 鉴权：HTTP Header  Authorization: Bearer <SPARK_API_KEY>
//   SPARK_API_KEY 即讯飞开放平台控制台生成的"接口密钥"(APIPassword)
//
// 未配置密钥时自动进入 mock 模式，输出与赛题场景一致的占位内容，
// 保证前端可端到端联调；拿到密钥后填入 .env 即切换为真实调用。

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export type Stage = "profile" | "planner" | "doc" | "tutor" | "eval";

const DEFAULT_BASE_URL = "https://spark-api-open.xf-yun.com/v1";
const DEFAULT_MODEL = "4.0Ultra";

function baseUrl(): string {
  return process.env.SPARK_BASE_URL || DEFAULT_BASE_URL;
}

export function isMockMode(): boolean {
  return !process.env.SPARK_API_KEY;
}

/** 分阶段模型路由：不同任务阶段使用不同模型（参考 OpenMAIC MODEL_ROUTES 设计） */
function modelForStage(stage: Stage): string {
  let routes: Record<string, string> = {};
  const raw = process.env.MODEL_ROUTES;
  if (raw) {
    try {
      routes = JSON.parse(raw);
    } catch {
      /* 忽略格式错误 */
    }
  }
  return routes[stage] || process.env.SPARK_DEFAULT_MODEL || DEFAULT_MODEL;
}

/**
 * 从可能包含 markdown 代码块/多余文字的模型输出中提取 JSON 对象。
 * 防御性解析：先尝试整体 parse，失败则截取首个 { 到末个 }。
 */
export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* fall through */
  }
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1)) as T;
  }
  throw new Error("无法从模型输出中解析 JSON");
}

interface CallOptions {
  messages: ChatMsg[];
  stage: Stage;
  temperature?: number;
}

/** 非流式调用：返回完整文本 */
export async function callSpark(opts: CallOptions): Promise<string> {
  if (isMockMode()) {
    return mockResponse(opts);
  }
  const model = modelForStage(opts.stage);
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SPARK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      stream: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`星火接口错误 ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** 流式调用：异步生成器，逐 token 产出文本增量 */
export async function* streamSpark(
  opts: CallOptions,
): AsyncGenerator<string, void, unknown> {
  if (isMockMode()) {
    yield* mockStream(mockResponse(opts));
    return;
  }
  const model = modelForStage(opts.stage);
  const res = await fetch(`${baseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SPARK_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`星火接口错误 ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        /* 跳过不完整的 SSE 帧 */
      }
    }
  }
}

/* ===================== Mock 模式（无密钥时） ===================== */

async function* mockStream(text: string): AsyncGenerator<string> {
  // 按字符/小段切分，模拟真实流式打字效果
  const chunks = text.match(/[\s\S]{1,6}/g) ?? [text];
  for (const c of chunks) {
    yield c;
    await new Promise((r) => setTimeout(r, 8));
  }
}

function mockResponse(opts: CallOptions): string {
  switch (opts.stage) {
    case "profile":
      return JSON.stringify(mockProfile(), null, 2);
    case "planner":
      return JSON.stringify(mockPlan(), null, 2);
    case "doc":
    default:
      return mockDoc(opts.messages);
  }
}

function mockProfile() {
  return {
    knowledge_level: { 数组: 35, 链表: 20, "栈与队列": 15, 排序: 40, 查找: 25, 复杂度: 30 },
    cognitive_style: "visual",
    error_patterns: ["边界条件", "指针操作", "递归终止"],
    learning_goal: "exam",
    learning_pace: "medium",
    interests: ["算法", "数据结构", "编程"],
  };
}

function mockPlan() {
  return {
    path_title: "数据结构与算法 · 零基础起步路径",
    estimated_time: "约 6 小时",
    steps: [
      {
        step: 1,
        title: "夯实线性结构基础",
        description: "从数组与链表入手，理解连续存储与链式存储的差异。",
        resource_tasks: [
          { type: "doc", topic: "数组与链表入门", reason: "构建线性结构认知" },
          { type: "quiz", topic: "数组与链表基础练习", reason: "巩固概念" },
        ],
        estimated_minutes: 60,
      },
      {
        step: 2,
        title: "掌握受限线性结构",
        description: "学习栈与队列，理解 LIFO/FIFO 及其在算法中的应用。",
        resource_tasks: [{ type: "doc", topic: "栈与队列" }],
        estimated_minutes: 50,
      },
      {
        step: 3,
        title: "进入排序与查找",
        description: "对比各类排序算法，掌握二分查找。",
        resource_tasks: [
          { type: "doc", topic: "排序算法对比" },
          { type: "code", topic: "快速排序实现" },
        ],
        estimated_minutes: 90,
      },
    ],
  };
}

function mockDoc(messages: ChatMsg[]): string {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const topic = /链表|节点/.test(user)
    ? "链表"
    : /栈|队列/.test(user)
      ? "栈与队列"
      : /排序/.test(user)
        ? "排序算法"
        : /查找|二分/.test(user)
          ? "查找算法"
          : "数组与链表";
  return `# ${topic} · 个性化讲解文档

> 本文档由"文档生成智能体"基于知识库生成（mock 模式），适合视觉型、中等节奏的学习者。

## 学习目标
- 理解 ${topic} 的核心定义与特性
- 掌握典型操作的时间复杂度
- 识别常见易错点

## 核心概念
${topic} 是数据结构与算法课程中的关键内容。理解其原理有助于在编程中合理选择数据组织方式，从而在时间与空间之间取得平衡。

> （参考：知识库 · ${topic === "数组与链表" ? "数组/链表" : topic}）

## 复杂度速查
| 操作 | 复杂度 |
| --- | --- |
| 访问 | O(1) / O(n) |
| 插入删除 | O(n) / O(1) |

## 易错提醒
1. 边界条件处理不当（空集合、单元素）。
2. 遍历中修改结构导致下标错位。
3. 指针操作丢失引用。

## 小结
建议结合配套题库进行练习，巩固对 ${topic} 的理解。后续路径将引导进入排序与查找算法。

---
*（mock 模式输出：填入讯飞星火密钥后，本文档将由星火大模型基于 RAG 检索内容真实生成。）*`;
}
