import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const conv = await prisma.tutorConversation.findFirst({
    where: { id, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!conv) return NextResponse.json({ error: "对话不存在" }, { status: 404 });

  return NextResponse.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      })),
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const conv = await prisma.tutorConversation.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!conv) return NextResponse.json({ error: "对话不存在" }, { status: 404 });

  await prisma.tutorConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
