// 浏览器端 SSE 消费器：POST 到 /api/learn 并解析 text/event-stream
import type { AgentEvent } from "@/backend/types";

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
    if ((e as Error).name === "AbortError") {
      handlers.onClose?.();
      return;
    }
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
    if ((e as Error).name === "AbortError") {
      handlers.onClose?.();
      return;
    }
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
    const event = { ...parsed, type };
    if (!validateAgentEvent(event)) return null;
    return event as AgentEvent;
  } catch {
    return null;
  }
}

function validateAgentEvent(e: { type: string; [k: string]: unknown }): boolean {
  switch (e.type) {
    case "status":
      return typeof e.agent === "string" && typeof e.message === "string";
    case "profile":
      return e.profile != null && typeof e.profile === "object";
    case "path":
      return e.path != null && typeof e.path === "object";
    case "resource_start":
      return (
        typeof e.id === "string" &&
        typeof e.resType === "string" &&
        typeof e.title === "string" &&
        typeof e.topic === "string"
      );
    case "resource_delta":
      return typeof e.id === "string" && typeof e.text === "string";
    case "resource":
      return e.resource != null && typeof e.resource === "object";
    case "done":
    case "error":
      return true;
    default:
      return false;
  }
}

/** 通用文本增量 SSE 消费器：用于辅导等"逐 token 文本流"接口。
 *  约定事件：delta{ text } / done / error{ message } */
export async function streamTextSse(
  url: string,
  body: unknown,
  handlers: {
    onDelta: (text: string) => void;
    onDone?: () => void;
    onError?: (e: Error) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
        let type: string | null = null;
        let dataStr = "";
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) type = line.slice(6).trim();
          else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
        }
        if (!type) continue;
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(dataStr);
        } catch {
          continue;
        }
        if (type === "delta" && typeof parsed.text === "string") {
          handlers.onDelta(parsed.text);
        } else if (type === "error") {
          handlers.onError?.(new Error(String(parsed.message ?? "未知错误")));
        } else if (type === "done") {
          handlers.onDone?.();
        }
      }
    }
    handlers.onDone?.();
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    handlers.onError?.(e as Error);
  }
}
