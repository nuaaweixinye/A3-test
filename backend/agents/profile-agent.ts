// ProfileAgent: extracts and incrementally updates a six-dimension learning profile.

import { callSpark, extractJson, type ChatMsg } from "@/backend/ai/spark";
import type { StudentProfile } from "@/backend/types";

const SYSTEM_PROMPT = `你是一名学习画像分析专家。请基于学生最新对话和已有画像，抽取并更新个性化学习画像。

你只能输出严格 JSON，不要 Markdown 代码块，不要解释文字。JSON 结构如下：
{
  "knowledge_level": {"知识点名称": 0到100的整数},
  "cognitive_style": "visual" | "auditory" | "reading" | "kinesthetic",
  "error_patterns": ["容易出错的模式"],
  "learning_goal": "exam" | "project" | "research" | "interest",
  "learning_pace": "fast" | "medium" | "slow",
  "interests": ["兴趣方向"]
}

判断规则：
1. 必须完整输出 6 个维度，字段名不能变化。
2. knowledge_level 的 key 使用简短中文知识点名，最多 8 个。value 表示掌握度：0=完全不会，100=熟练掌握。
3. 优先保留历史画像中仍然可信的知识点，再根据最新发言增量更新，不要无依据地大幅推翻历史。
4. 如果学生明确表达“不懂、薄弱、容易混淆”，相关知识点掌握度应低于 55。
5. 如果学生表达“会、熟悉、已经掌握”，相关知识点掌握度可高于 70。
6. error_patterns 要描述具体错误模式，例如“概念混淆”“公式套用困难”“代码调试薄弱”，不要写空泛词。
7. interests 只保留学习内容相关兴趣，最多 6 个。
8. 信息不足时使用合理默认：knowledge_level 为 {}，cognitive_style 为 "visual"，error_patterns 为 []，learning_goal 为 "interest"，learning_pace 为 "medium"，interests 为 []。`;

export async function extractProfile(
  message: string,
  history: StudentProfile | null = null,
): Promise<StudentProfile> {
  const userPrompt = `当前画像历史：
${history ? JSON.stringify(history) : "无"}

学生最新发言：
"""
${message}
"""

请综合判断并输出更新后的 6 维度学习画像 JSON。`;

  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const raw = await callSpark({ messages, stage: "profile", temperature: 0.25 });
  const parsed = extractJson<Partial<StudentProfile>>(raw);
  return normalizeProfile(parsed, history);
}

function normalizeProfile(
  profile: Partial<StudentProfile>,
  history: StudentProfile | null,
): StudentProfile {
  const mergedKnowledge = {
    ...(history?.knowledge_level ?? {}),
    ...(profile.knowledge_level && typeof profile.knowledge_level === "object"
      ? profile.knowledge_level
      : {}),
  };

  const knowledge_level = Object.fromEntries(
    Object.entries(mergedKnowledge)
      .filter(([key]) => key.trim().length > 0)
      .slice(0, 8)
      .map(([key, value]) => [
        key.trim().slice(0, 18),
        Math.max(0, Math.min(100, Math.round(Number(value) || 0))),
      ]),
  );

  return {
    knowledge_level,
    cognitive_style: pickEnum(
      profile.cognitive_style,
      ["visual", "auditory", "reading", "kinesthetic"],
      history?.cognitive_style ?? "visual",
    ),
    error_patterns: normalizeStringList(
      profile.error_patterns,
      history?.error_patterns ?? [],
      6,
    ),
    learning_goal: pickEnum(
      profile.learning_goal,
      ["exam", "project", "research", "interest"],
      history?.learning_goal ?? "interest",
    ),
    learning_pace: pickEnum(
      profile.learning_pace,
      ["fast", "medium", "slow"],
      history?.learning_pace ?? "medium",
    ),
    interests: normalizeStringList(profile.interests, history?.interests ?? [], 6),
    updated_at: new Date().toISOString(),
  };
}

function pickEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function normalizeStringList(
  value: unknown,
  fallback: string[],
  max: number,
): string[] {
  const raw = Array.isArray(value) ? value : fallback;
  return Array.from(
    new Set(
      raw
        .map(String)
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, 24)),
    ),
  ).slice(0, max);
}
