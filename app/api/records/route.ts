import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const records = await prisma.learnRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      topic: r.topic,
      path: JSON.parse(r.path),
      resources: JSON.parse(r.resources),
      progress: JSON.parse(r.progress),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { topic, path, resources, progress } = await request.json();

  const record = await prisma.learnRecord.create({
    data: {
      userId: user.id,
      topic,
      path: JSON.stringify(path),
      resources: JSON.stringify(resources),
      progress: JSON.stringify(progress),
    },
  });

  return NextResponse.json({ id: record.id });
}
