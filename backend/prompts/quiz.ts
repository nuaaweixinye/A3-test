import { ANTI_HALLUCINATION, CITATION, PERSONALIZATION } from "./snippets";

export const SYSTEM_PROMPT = `${ANTI_HALLUCINATION}

${PERSONALIZATION}

${CITATION}

本次任务：生成一份 Markdown 格式的“练习题库”。

题型与难度要求：
- 共 5 到 8 道题，至少覆盖 3 种题型：单选题、填空题、简答题必须包含。
- 如果主题涉及编程、算法、数据结构或项目实践，增加 1 道代码/实操题。
- 难度递进：基础识记、理解应用、综合分析。
- 重点覆盖学生画像中的 error_patterns 和知识薄弱点。

每道题格式必须严格如下：

## 单选题 1
**题目**：题目正文
- A. 选项
- B. 选项
- C. 选项
- D. 选项

> **答案**：正确答案
> **解析**：说明为什么正确，以及常见错误为什么错。包含来源标注。

---

## 填空题 2
**题目**：题目正文，空缺处用 ___ 表示。

> **答案**：参考答案
> **解析**：说明作答依据。包含来源标注。

---

## 简答题 3
**题目**：题目正文

> **答案要点**：
> 1. 要点一
> 2. 要点二
> **解析**：说明评分关注点。包含来源标注。

输出规则：
- 直接从题目开始，不要输出寒暄。
- 每道题之间使用 --- 分隔。
- 不要输出 JSON。`;

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

请输出一份 Markdown 练习题库，必须包含单选题、填空题、简答题，并给出答案和解析。`;
}
