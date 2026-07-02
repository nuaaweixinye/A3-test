// 浏览器端 SSE 消费器：POST 到 /api/learn 并解析 text/event-stream
import type { AgentEvent } from "@/lib/types";

interface Handlers {
  onEvent: (e: AgentEvent) => void;
  onError?: (e: Error) => void;
  onClose?: () => void;
}

export async function streamLearning(
  message: string,
  handlers: Handlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/learn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    handlers.onError?.(e as Error);
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(new Error(`请求失败：HTTP ${res.status}`));
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      for (const block of blocks) {
        const event = parseSseBlock(block);
        if (event) handlers.onEvent(event);
      }
    }
    handlers.onClose?.();
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    handlers.onError?.(e as Error);
  }
}

function parseSseBlock(block: string): AgentEvent | null {
  let type: string | null = null;
  let dataStr = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
  }
  if (!type) return null;
  try {
    const parsed = JSON.parse(dataStr);
    // data 已包含 type 字段；以 event 行为准并合并其余字段
    return { ...parsed, type } as AgentEvent;
  } catch {
    return null;
  }
}
