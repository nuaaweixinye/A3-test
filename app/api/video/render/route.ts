import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";
import { renderTeachingVideo } from "@/backend/video/render";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await request.json()) as {
    content?: string;
    topic?: string;
  };

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "缺少视频分镜内容" }, { status: 400 });
  }

  try {
    const result = await renderTeachingVideo({
      content: body.content,
      topic: body.topic || "教学视频",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "视频生成失败" },
      { status: 500 },
    );
  }
}
