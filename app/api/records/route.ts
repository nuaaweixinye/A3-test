import { NextResponse, type NextRequest } from "next/server";
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
    records: records.map((record) => ({
      id: record.id,
      topic: record.topic,
      path: safeJson(record.path, null),
      resources: dedupeResources(safeJson(record.resources, [])),
      progress: safeJson(record.progress, {}),
      createdAt: record.createdAt.toISOString(),
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
      topic: String(topic || path?.path_title || "学习记录"),
      path: JSON.stringify(path || null),
      resources: JSON.stringify(dedupeResources(Array.isArray(resources) ? resources : [])),
      progress: JSON.stringify(progress || {}),
    },
  });

  return NextResponse.json({ id: record.id });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "缺少记录 id" }, { status: 400 });
  }

  const record = await prisma.learnRecord.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!record) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  await prisma.learnRecord.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function dedupeResources<T extends { resType?: string; type?: string; id?: string }>(
  resources: T[],
): T[] {
  const byType = new Map<string, T>();
  const order: string[] = [];
  for (const resource of resources) {
    const key = resource.resType || resource.type || resource.id;
    if (!key) continue;
    if (!byType.has(key)) order.push(key);
    byType.set(key, resource);
  }
  return order.map((key) => byType.get(key)!);
}
