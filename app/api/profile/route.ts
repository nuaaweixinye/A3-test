import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";
import type { StudentProfile } from "@/backend/types";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const row = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!row) {
    return NextResponse.json({ profile: null });
  }

  const profile: StudentProfile = {
    knowledge_level: safeJson(row.knowledgeLevel, {}),
    cognitive_style: row.cognitiveStyle as StudentProfile["cognitive_style"],
    error_patterns: safeJson(row.errorPatterns, []),
    learning_goal: row.learningGoal as StudentProfile["learning_goal"],
    learning_pace: row.learningPace as StudentProfile["learning_pace"],
    interests: safeJson(row.interests, []),
    updated_at: row.updatedAt.toISOString(),
  };

  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { profile } = (await request.json()) as { profile: StudentProfile };

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      knowledgeLevel: JSON.stringify(profile.knowledge_level),
      cognitiveStyle: profile.cognitive_style,
      errorPatterns: JSON.stringify(profile.error_patterns),
      learningGoal: profile.learning_goal,
      learningPace: profile.learning_pace,
      interests: JSON.stringify(profile.interests),
    },
    update: {
      knowledgeLevel: JSON.stringify(profile.knowledge_level),
      cognitiveStyle: profile.cognitive_style,
      errorPatterns: JSON.stringify(profile.error_patterns),
      learningGoal: profile.learning_goal,
      learningPace: profile.learning_pace,
      interests: JSON.stringify(profile.interests),
    },
  });

  return NextResponse.json({ ok: true });
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
