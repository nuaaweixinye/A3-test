// 讯飞星火大模型客户端 —— OpenAI 兼容接口
// 出题企业：科大讯飞（赛题硬性要求 AI 辅助工具须选用讯飞相关工具）
//
// 兼容端点：https://spark-api-open.xf-yun.com/v1/chat/completions
// 鉴权：HTTP Header  Authorization: Bearer <SPARK_API_KEY>
//   SPARK_API_KEY 即讯飞开放平台控制台生成的"接口密钥"(APIPassword)
//
// 未配置密钥时自动进入 mock 模式，输出与赛题场景一致的占位内容，
// 保证前端可端到端联调；拿到密钥后填入 .env 即切换为真实调用。

import type { ResourceType } from "@/lib/types";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 分阶段模型路由的"阶段"：画像 / 规划 / 各资源类型 / 辅导 / 评估 */
export type Stage = "profile" | "planner" | ResourceType | "tutor" | "eval";

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
    case "quiz":
      return mockQuiz(extractTopic(opts.messages));
    case "mindmap":
      return mockMindmap(extractTopic(opts.messages));
    case "code":
      return mockCode(extractTopic(opts.messages));
    case "reading":
      return mockReading(extractTopic(opts.messages));
    case "video":
      return mockVideo(extractTopic(opts.messages));
    case "tutor":
      return mockTutor(extractQuestion(opts.messages));
    case "eval":
      return JSON.stringify(mockEval(opts.messages), null, 2);
    case "doc":
    default:
      return mockDoc(extractTopic(opts.messages));
  }
}

/** 从辅导 Prompt 中解析学生提问（tutor-agent 的 user prompt 含【问题】xxx） */
function extractQuestion(messages: ChatMsg[]): string {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const m = user.match(/【问题】([^\n]*)/);
  if (m && m[1].trim()) return m[1].trim();
  return user.slice(0, 60);
}

/** 从 Prompt 中解析主题（resource-runner 的 user prompt 含【主题】xxx） */
function extractTopic(messages: ChatMsg[]): string {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const m = user.match(/【主题】([^\n]*)/);
  if (m && m[1].trim()) return m[1].trim();
  if (/链表|节点/.test(user)) return "链表";
  if (/栈|队列/.test(user)) return "栈与队列";
  if (/排序/.test(user)) return "排序算法";
  if (/查找|二分/.test(user)) return "查找算法";
  if (/树|二叉|递归/.test(user)) return "树与递归";
  return "数据结构与算法";
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

function mockDoc(topic: string): string {
  return `# ${topic} · 个性化讲解文档

> 本文档由"文档生成智能体"基于知识库生成（mock 模式），适合视觉型、中等节奏的学习者。

## 学习目标
- 理解 ${topic} 的核心定义与特性
- 掌握典型操作的时间复杂度
- 识别常见易错点

## 核心概念
${topic} 是数据结构与算法课程中的关键内容。理解其原理有助于在编程中合理选择数据组织方式，从而在时间与空间之间取得平衡。

> （参考：知识库 · ${topic}）

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
建议结合配套题库进行练习，巩固对 ${topic} 的理解。

---
*（mock 模式输出：填入讯飞星火密钥后，本文档将由星火大模型基于 RAG 检索内容真实生成。）*`;
}

function mockQuiz(topic: string): string {
  return `# ${topic} · 练习题库（mock）

## 一、单选题
**1. 关于 ${topic}，下列说法正确的是？**
- A. 访问任意元素的时间复杂度为 O(n)
- B. 访问任意元素的时间复杂度为 O(1)
- C. 不能存储重复元素
- D. 必须排序后才能使用

> **答案：B**　**解析：** ${topic} 支持随机访问，按下标访问为 O(1)。（参考：知识库 · ${topic}）

**2. 在 ${topic} 中删除头部元素，最坏时间复杂度为？**
- A. O(1)　- B. O(log n)　- C. O(n)　- D. O(n²)

> **答案：C**　**解析：** 删除头部后需移动后续元素，最坏 O(n)。

## 二、填空题
**3.** 顺序存储结构通过 ______ 访问元素，时间复杂度为 ______。
> **答案：** 下标（索引）；O(1)

## 三、简答题
**4.** 请简述 ${topic} 相比其他结构的优缺点。
> **参考要点：** 优点是随机访问 O(1)、缓存友好；缺点是插入删除需移动元素、容量受限。

## 四、编程题
**5.** 实现一个函数，在 ${topic} 中查找指定值并返回其位置。
> 提示：遍历比较即可，时间 O(n)。

---
*（mock 模式：接入星火后由题库智能体真实生成）*`;
}

function mockMindmap(topic: string): string {
  return `# ${topic} · 知识点思维导图（mock）

- ${topic}
  - 基本定义
    - 存储方式
    - 特性
  - 核心操作
    - 访问 / 查找
    - 插入 / 删除
    - 时间复杂度分析
  - 典型变体
    - 静态 vs 动态
    - 线性 vs 链式
  - 常见应用场景
    - 序列存储
    - 算法优化（前缀和等）
  - 易错点
    - 边界条件
    - 下标越界
    - 指针丢失

---
*（mock 模式：接入星火后由导图智能体真实生成层级结构）*`;
}

function mockCode(topic: string): string {
  return `# ${topic} · 代码实操案例（mock）

## 示例：${topic} 的基本操作

\`\`\`python
# ${topic} 基础操作演示
def demo():
    data = [3, 1, 4, 1, 5, 9, 2, 6]  # 以顺序存储为例
    # 访问 O(1)
    print("第3个元素:", data[2])
    # 查找 O(n)
    target = 5
    idx = data.index(target) if target in data else -1
    print(f"值 {target} 的位置: {idx}")
    # 插入（头部，O(n)）
    data.insert(0, 0)
    print("插入后:", data)

demo()
\`\`\`

## 复杂度分析
- 访问：O(1)
- 查找：O(n)
- 头部插入：O(n)（需移动元素）

## 易错点
1. \`insert(0, x)\` 是 O(n)，在循环中调用会退化为 O(n²)。
2. 遍历时 \`remove\会导致下标错位。

---
*（mock 模式：接入星火后由代码智能体生成并校验）*`;
}

function mockReading(topic: string): string {
  return `# ${topic} · 拓展阅读清单（mock）

基于课程知识库推荐以下学习材料：

1. **知识库 · ${topic}**　— 本系统的原始课程素材，含定义、复杂度与易错点。
2. **教材补充**　— 《数据结构与算法分析》对应章节，建议精读复杂度证明。
3. **可视化练习**　— VisuAlgo / 数据结构可视化网站，动态观察操作过程。
4. **真题练习**　— 历年期末/考研真题中 ${topic} 相关题目。
5. **延伸主题**　— 由 ${topic} 衍生的进阶内容（如前缀和、单调结构等）。

> 说明：真实模式下，阅读智能体会结合 RAG 检索结果给出更精准的来源与章节引用。

---
*（mock 模式输出）*`;
}

function mockVideo(topic: string): string {
  return `# ${topic} · 教学视频分镜脚本（mock）

> 由"视频生成智能体"产出分镜脚本，点击右上角"▶ 语音播放"可用浏览器语音朗读旁白（占位配音；接入讯飞 TTS 后替换）。

## 分镜 1（15s）
- **旁白**：你好，这一节我们来学习 ${topic}。它是最基础也是最重要的数据结构之一。
- **画面**：标题卡片"${topic}"，背景渐变蓝色。

## 分镜 2（20s）
- **旁白**：它的核心特点是元素在内存中连续存储，因此可以通过下标在 O(1) 时间内随机访问。
- **画面**：动画演示连续内存格子，下标高亮跳转。

## 分镜 3（20s）
- **旁白**：不过，在中间或头部插入删除时，需要移动后续元素，最坏时间复杂度为 O(n)。
- **画面**：插入元素时后方格子依次右移的动画。

## 分镜 4（15s）
- **旁白**：记住三个易错点：边界条件、下标越界、遍历中修改结构。多做练习巩固吧！
- **画面**：三个要点以图标列表呈现，结尾出现"练习"按钮。

---
*（mock 模式：接入星火 + 讯飞 TTS 后，分镜与配音将由大模型真实生成）*`;
}

/* ============ 加分项 ④/⑤ 的 mock ============ */

function mockTutor(question: string): string {
  return `**关于：${question}**

根据课程知识库，简要解答如下：

1. **核心要点**：这是一个数据结构与算法中的常见问题。建议先厘清基本定义，再分析时间/空间复杂度。
2. **图解思路**：
   \`\`\`mermaid
   flowchart LR
     A[输入] --> B{判断条件}
     B -- 是 --> C[处理分支1]
     B -- 否 --> D[处理分支2]
     C --> E[输出]
     D --> E
   \`\`\`
3. **示例**：以数组为例，遍历比较即可定位元素，时间复杂度 O(n)。
4. **易错提醒**：注意边界条件与空集合的特判。

> （参考：知识库 · 数据结构与算法）

---
*（mock 模式：接入星火后由辅导智能体基于 RAG 真实作答）*`;
}

/** mock 评估：从 Prompt 中解析自评掌握度，做真实计算（让闭环演示可信） */
function mockEval(messages: ChatMsg[]): Record<string, unknown> {
  const user = messages.find((m) => m.role === "user")?.content ?? "";
  const mastery: Record<string, number> = {};
  const m = user.match(/【自评掌握度】\s*([\s\S]*?)(?:\n【|\n$|$)/);
  if (m) {
    try {
      const obj = JSON.parse(m[1].trim());
      for (const [k, v] of Object.entries(obj)) {
        mastery[k] = Math.max(0, Math.min(100, Number(v) || 0));
      }
    } catch {
      /* ignore */
    }
  }
  const topics = Object.keys(mastery);
  if (topics.length === 0) {
    mastery["数据结构基础"] = 55;
    mastery["排序算法"] = 45;
    mastery["查找算法"] = 60;
  }
  const vals = Object.values(mastery);
  const overall = vals.length
    ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
    : 50;
  const weak = Object.entries(mastery)
    .filter(([, v]) => v < 60)
    .map(([k]) => k);
  const strong = Object.entries(mastery)
    .filter(([, v]) => v >= 80)
    .map(([k]) => k);
  const trend = overall >= 70 ? "improving" : overall >= 55 ? "steady" : "needs_review";

  const recommendations: string[] = [];
  if (weak.length) {
    recommendations.push(`针对薄弱主题（${weak.join("、")}）回到「学习中心」重看讲解文档与题库。`);
  }
  if (overall < 60) {
    recommendations.push("整体掌握度偏低，建议放慢节奏（learning_pace 调整为 slow）并增加练习。");
  } else {
    recommendations.push("保持当前节奏，尝试代码实操与拓展阅读以巩固。");
  }
  recommendations.push("可进入「智能辅导」对仍不清晰的知识点进行即时追问。");

  return {
    overall_score: overall,
    mastery,
    weak_points: weak,
    strong_points: strong,
    progress_trend: trend,
    recommendations,
    profile_update: { knowledge_level: mastery },
    path_adjustment: {
      action: weak.length ? "review" : overall >= 75 ? "advance" : "steady",
      focus_topics: weak,
      summary: weak.length
        ? `检测到 ${weak.length} 个薄弱主题，建议优先复习。`
        : "各主题掌握均衡，可进入下一阶段。",
    },
  };
}
