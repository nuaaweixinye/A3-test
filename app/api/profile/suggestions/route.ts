import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";
import { prisma } from "@/backend/auth/prisma";
import { callSpark, type ChatMsg } from "@/backend/ai/spark";
import type { StudentProfile } from "@/backend/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { profile } = (await request.json()) as { profile: StudentProfile | null };

  const latestEval = await prisma.evalRecord.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const weakStr = latestEval
    ? `最近评估${latestEval.overallScore}分，薄弱点：${JSON.parse(latestEval.weakPoints).join("、")}`
    : "暂无评估数据";

  const messages: ChatMsg[] = [
    {
      role: "system",
      content:
        '你是学习顾问。基于学生画像生成3条个性化学习建议。每条不超过40字，具体可执行。只输出JSON数组，如 ["建议1","建议2","建议3"]',
    },
    {
      role: "user",
      content: `画像：${JSON.stringify(profile || {})}\n${weakStr}\n请生成建议。`,
    },
  ];

  try {
    const raw = await callSpark({ messages, stage: "eval", temperature: 0.5 });
    const match = raw.match(/\[[\s\S]*\]/);
    const suggestions = match ? JSON.parse(match[0]) : ["坚持每日学习", "多做练习巩固知识", "结合视频和文档学习"];
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({
      suggestions: ["坚持每日学习", "多做练习巩固知识", "结合视频和文档学习"],
    });
  }
}
