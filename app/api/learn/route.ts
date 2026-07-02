// SSE 流式接口：对话 → 画像 → 路径 → 文档生成 闭环
// 前端 POST { message } → 本路由流式返回事件：
//   status | profile | path | doc_delta | resource | done | error

import { runLearningLoop, type StreamWriter } from "@/lib/graph";
import type { AgentEvent } from "@/lib/types";
import { isMockMode } from "@/lib/ai/spark";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: AgentEvent): Uint8Array {
  return encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export async function POST(req: Request) {
  let message = "";
  try {
    const body = await req.json();
    message = String(body?.message ?? "").trim();
  } catch {
    /* 非法 JSON，message 保持空 */
  }
  if (!message) {
    return new Response(JSON.stringify({ error: "缺少 message 字段" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mode = isMockMode() ? "mock（未配置讯飞星火密钥）" : "spark";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AgentEvent) => controller.enqueue(sse(e));

      const writer: StreamWriter = (text: string) => {
        if (text) send({ type: "doc_delta", text });
      };

      send({
        type: "status",
        agent: "system",
        message: `多智能体闭环已启动（模式：${mode}）`,
      });

      try {
        const graphStream = await runLearningLoop({ userMessage: message }, {
          configurable: {
            writer,
            onStatus: (agent, msg) => send({ type: "status", agent, message: msg }),
          },
        });

        for await (const chunk of graphStream) {
          // streamMode=updates：每个 yield 形如 { 节点名: 该节点返回的状态增量 }
          const update = chunk as Record<string, Record<string, unknown>>;
          for (const [node, delta] of Object.entries(update)) {
            if (!delta) continue;
            if (node === "profile_builder" && delta.profile) {
              send({ type: "profile", profile: delta.profile as never });
            } else if (node === "path_planner") {
              if (delta.path) send({ type: "path", path: delta.path as never });
            } else if (node === "doc_generator" && delta.resource) {
              send({ type: "resource", resource: delta.resource as never });
            }
          }
        }
        send({ type: "done" });
      } catch (err) {
        send({
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
