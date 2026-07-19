import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";
import { prisma } from "@/backend/auth/prisma";
import { callSpark, type ChatMsg } from "@/backend/ai/spark";
import type { StudentProfile } from "@/backend/types";

export const runtime = "nodejs";

const FALLBACK_SUGGESTIONS = [
  "先复习掌握度低于 60 的知识点，并补一组针对性练习",
  "把最新资源中的关键概念整理成 5 条自己的解释",
  "完成一次学习评估，用结果更新下一轮学习路径",
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { profile } = (await request.json()) as { profile: StudentProfile | null };

  const latestEval = await prisma.evalRecord.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const weakPoints = latestEval ? safeJson<string[]>(latestEval.weakPoints, []) : [];
  const evalSummary = latestEval
    ? `最近评估：${latestEval.overallScore} 分；薄弱点：${weakPoints.join("、") || "暂无"}`
    : "暂无评估数据";

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        '你是学习顾问。请基于学生画像和最近评估生成 3 条个性化学习建议。每条不超过 40 个中文字符，必须具体可执行。只输出 JSON 数组，例如 ["建议1","建议2","建议3"]。',
    },
    {
      role: "user",
      content: `学生画像：${JSON.stringify(profile || {})}\n${evalSummary}\n请生成建议。`,
    },
  ];

  try {
    const raw = await callSpark({ messages, stage: "eval", temperature: 0.45 });
    const match = raw.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : FALLBACK_SUGGESTIONS;
    return NextResponse.json({ suggestions: normalizeSuggestions(suggestions) });
  } catch {
    return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });
  }
}

function normalizeSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) return FALLBACK_SUGGESTIONS;
  const suggestions = value.map(String).map((item) => item.trim()).filter(Boolean);
  return suggestions.length > 0 ? suggestions.slice(0, 3) : FALLBACK_SUGGESTIONS;
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
