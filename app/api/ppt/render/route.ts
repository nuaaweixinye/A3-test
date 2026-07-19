import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";
import { renderTeachingPpt } from "@/backend/ppt/render";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const content = String(body?.content ?? "");
    const topic = String(body?.topic ?? "教学课件");
    if (!content.trim()) {
      return NextResponse.json({ error: "缺少 PPT 内容" }, { status: 400 });
    }
    if (isFailedResourceContent(content)) {
      return NextResponse.json(
        { error: "当前资源内容生成失败，请先重新生成资源，再生成 PPT。" },
        { status: 400 },
      );
    }

    const result = await renderTeachingPpt({ content, topic });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PPT 生成失败" },
      { status: 500 },
    );
  }
}

function isFailedResourceContent(value: string): boolean {
  return /^>\s*生成失败|^生成失败：|请求已取消|接口限流|QPS/i.test(value.trim());
}
