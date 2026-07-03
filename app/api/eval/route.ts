// 评估接口（加分项 ⑤）：POST { profile, progress, topics } → 返回 EvaluationResult JSON

import { evaluate } from "@/lib/agents/eval-agent";
import type { StudentProfile, TopicProgress } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EvalBody {
  profile?: StudentProfile | null;
  progress?: Record<string, TopicProgress>;
  topics?: string[];
}

export async function POST(req: Request) {
  let body: EvalBody = {};
  try {
    body = (await req.json()) as EvalBody;
  } catch {
    /* 非法 JSON */
  }

  const topics = Array.isArray(body.topics)
    ? body.topics.filter((t) => typeof t === "string")
    : [];

  if (topics.length === 0) {
    return new Response(
      JSON.stringify({ error: "缺少 topics（请先生成学习资源）" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await evaluate({
      profile: body.profile ?? null,
      progress: body.progress ?? {},
      topics,
    });
    return Response.json(result);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
