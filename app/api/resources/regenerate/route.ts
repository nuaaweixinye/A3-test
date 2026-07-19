import { NextResponse } from "next/server";
import { generateCode } from "@/backend/agents/code-agent";
import { generateDesign } from "@/backend/agents/design-agent";
import { generateDoc } from "@/backend/agents/doc-agent";
import { generateMindmap } from "@/backend/agents/mindmap-agent";
import { generateQuiz } from "@/backend/agents/quiz-agent";
import { generateReading } from "@/backend/agents/reading-agent";
import { generateVideo } from "@/backend/agents/video-agent";
import { getCurrentUser } from "@/backend/auth/session";
import type {
  GeneratedResource,
  ResourceTask,
  ResourceType,
  StudentProfile,
} from "@/backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERATORS: Record<
  ResourceType,
  (
    profile: StudentProfile,
    task: ResourceTask,
  ) => Promise<GeneratedResource>
> = {
  design: generateDesign,
  doc: generateDoc,
  quiz: generateQuiz,
  mindmap: generateMindmap,
  video: generateVideo,
  code: generateCode,
  reading: generateReading,
};

const RESOURCE_TYPES = new Set<ResourceType>([
  "design",
  "doc",
  "quiz",
  "mindmap",
  "video",
  "code",
  "reading",
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const type = String(body?.type ?? "") as ResourceType;
    const topic = String(body?.topic ?? "").trim();
    const title = String(body?.title ?? topic).trim();
    const profile = body?.profile as StudentProfile | null | undefined;

    if (!RESOURCE_TYPES.has(type)) {
      return NextResponse.json({ error: "资源类型不正确" }, { status: 400 });
    }
    if (!topic) {
      return NextResponse.json({ error: "缺少资源主题" }, { status: 400 });
    }
    if (!profile) {
      return NextResponse.json(
        { error: "缺少学习画像，请先完成画像构建" },
        { status: 400 },
      );
    }

    const resource = await GENERATORS[type](profile, {
      type,
      topic,
      reason: `用户手动重新生成：${title || topic}`,
    });

    return NextResponse.json({ resource });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "重新生成失败" },
      { status: 500 },
    );
  }
}
