import { runLearningLoop } from "@/backend/graph";
import { sparkMode } from "@/backend/ai/spark";
import type { Emitter } from "@/backend/agents/resource-runner";
import type { AgentEvent, LearningPath, StudentProfile } from "@/backend/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: AgentEvent): Uint8Array {
  return encoder.encode(
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
}

function currentModeLabel(): string {
  const labels = {
    "spark-ws": "spark X1/X2 WebSocket",
    "spark-http": "spark HTTP 兼容接口",
    unconfigured: "未配置真实模型接口",
  } as const;
  return labels[sparkMode()];
}

export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = String(body?.message ?? "").trim();
  } catch {
    // Invalid JSON is handled by the missing-message branch below.
  }

  if (!message) {
    return new Response(JSON.stringify({ error: "缺少 message 字段" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: Emitter = (event) => controller.enqueue(sse(event));

      emit({
        type: "status",
        agent: "system",
        message: `多智能体闭环已启动（模式：${currentModeLabel()}）`,
      });

      try {
        const graphStream = await runLearningLoop(
          { userMessage: message },
          { configurable: { emit } },
        );

        for await (const chunk of graphStream) {
          const update = chunk as Record<string, Record<string, unknown>>;
          for (const [node, delta] of Object.entries(update)) {
            if (!delta) continue;
            if (node === "profile_builder" && delta.profile) {
              emit({ type: "profile", profile: delta.profile as StudentProfile });
            } else if (node === "path_planner" && delta.path) {
              emit({ type: "path", path: delta.path as LearningPath });
            }
          }
        }

        emit({ type: "done" });
      } catch (err) {
        emit({
          type: "error",
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
