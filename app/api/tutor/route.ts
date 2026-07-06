// SSE 流式接口：智能辅导（加分项 ④）
// 前端 POST { message, history, profile } → 流式返回 delta{ text } / done / error

import { answerTutorStream } from "@/backend/agents/tutor-agent";
import type { StudentProfile, TutorTurn } from "@/backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

interface TutorBody {
  message?: string;
  history?: TutorTurn[];
  profile?: StudentProfile | null;
}

export async function POST(req: Request) {
  let body: TutorBody = {};
  try {
    body = (await req.json()) as TutorBody;
  } catch {
    /* 非法 JSON */
  }
  const question = String(body.message ?? "").trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "缺少 message 字段" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (eventType: string, payload: Record<string, unknown> = {}) =>
        controller.enqueue(
          encoder.encode(
            `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`,
          ),
        );

      try {
        for await (const delta of answerTutorStream({
          question,
          history: body.history ?? [],
          profile: body.profile ?? null,
        })) {
          if (delta) send("delta", { text: delta });
        }
        send("done");
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
