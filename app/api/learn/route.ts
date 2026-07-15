// SSE 流式接口：对话 → 画像 → 路径 → 6 个资源 Agent 并行生成 闭环
// 前端 POST { message } → 本路由流式返回事件：
//   status | profile | path | resource_start | resource_delta | resource | done | error
//
// 资源相关事件由各资源节点通过注入的 emit 回调直接推送；
// profile/path 仍由 graph.stream 的 updates 翻译得到。

import { runLearningLoop } from "@/backend/graph";
import type { AgentEvent, StudentProfile, LearningPath } from "@/backend/types";
import { isMockMode } from "@/backend/ai/spark";
import type { Emitter } from "@/backend/agents/resource-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: AgentEvent): Uint8Array {
  return encoder.encode(
    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
  );
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
      const emit: Emitter = (e) => controller.enqueue(sse(e));

      emit({
        type: "status",
        agent: "system",
        message: `多智能体闭环已启动（模式：${mode}）`,
      });

      try {
        const graphStream = await runLearningLoop(
          { userMessage: message },
          { configurable: { emit } },
        );

        for await (const chunk of graphStream) {
          // streamMode=updates：每个 yield 形如 { 节点名: 该节点返回的状态增量 }
          const update = chunk as Record<string, Record<string, unknown>>;
          for (const [node, delta] of Object.entries(update)) {
            if (!delta) continue;
            if (node === "profile_builder" && delta.profile) {
              emit({ type: "profile", profile: delta.profile as StudentProfile });
            } else if (node === "path_planner" && delta.path) {
              emit({ type: "path", path: delta.path as LearningPath });
            }
            // 资源节点(*_gen)的事件已由 emit 直接推送，此处无需重复处理
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
