import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const [learnRecords, evalRecords, tutorConvs] = await Promise.all([
    prisma.learnRecord.findMany({
      where: { userId: user.id },
      select: { createdAt: true, resources: true },
    }),
    prisma.evalRecord.findMany({
      where: { userId: user.id },
      select: { overallScore: true, createdAt: true, trend: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tutorConversation.findMany({
      where: { userId: user.id },
      select: { createdAt: true },
    }),
  ]);

  const totalResources = learnRecords.reduce((sum, r) => {
    try {
      return sum + JSON.parse(r.resources).length;
    } catch {
      return sum;
    }
  }, 0);

  const evalCount = evalRecords.length;
  const avgScore =
    evalCount > 0
      ? Math.round(
          evalRecords.reduce((s, r) => s + r.overallScore, 0) / evalCount,
        )
      : 0;

  const activity: Record<string, number> = {};
  const allDates = [
    ...learnRecords.map((r) => r.createdAt),
    ...evalRecords.map((r) => r.createdAt),
    ...tutorConvs.map((r) => r.createdAt),
  ];
  for (const d of allDates) {
    const key = d.toISOString().slice(0, 10);
    activity[key] = (activity[key] || 0) + 1;
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (activity[key]) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  const scoreHistory = evalRecords
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      score: r.overallScore,
      date: r.createdAt.toISOString(),
    }));

  return NextResponse.json({
    totalSessions: learnRecords.length,
    totalResources,
    totalTutorConvs: tutorConvs.length,
    evalCount,
    avgScore,
    latestTrend: evalRecords[0]?.trend || "steady",
    streak,
    activity,
    scoreHistory,
  });
}
