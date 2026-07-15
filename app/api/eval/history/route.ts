import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const records = await prisma.evalRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    history: records.map((r) => ({
      id: r.id,
      overallScore: r.overallScore,
      mastery: JSON.parse(r.mastery),
      weakPoints: JSON.parse(r.weakPoints),
      strongPoints: JSON.parse(r.strongPoints),
      trend: r.trend,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
