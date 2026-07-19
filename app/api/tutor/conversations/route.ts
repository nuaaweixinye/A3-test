import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const conversations = await prisma.tutorConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messageCount: c._count.messages,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { title, messages } = await request.json();
  const safeMessages = Array.isArray(messages) ? messages : [];

  const conv = await prisma.tutorConversation.create({
    data: {
      userId: user.id,
      title: String(title || "新对话").slice(0, 60),
      messages: {
        create: safeMessages.map((m: { role?: string; content?: string }) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content || ""),
        })),
      },
    },
  });

  return NextResponse.json({ id: conv.id });
}
