import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";
import { listFiles } from "@/backend/knowledge/spark-kb";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const files = await listFiles();
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "获取失败" },
      { status: 500 },
    );
  }
}
