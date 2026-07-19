import crypto from "node:crypto";
import WebSocket from "ws";

import type { ResourceType } from "@/backend/types";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export type Stage = "profile" | "planner" | ResourceType | "tutor" | "eval";
export type SparkMode = "spark-ws" | "spark-http" | "unconfigured";

const DEFAULT_HTTP_BASE_URL = "https://spark-api-open.xf-yun.com/v1";
const DEFAULT_HTTP_MODEL = "4.0Ultra";
const DEFAULT_WS_URL = "wss://spark-api.xf-yun.com/x2";
const DEFAULT_WS_DOMAIN = "spark-x";
const DEFAULT_MIN_INTERVAL_MS = 2500;
const DEFAULT_RETRY_COUNT = 4;

let sparkLock: Promise<void> = Promise.resolve();
let lastSparkStart = 0;

interface CallOptions {
  messages: ChatMsg[];
  stage: Stage;
  temperature?: number;
  signal?: AbortSignal;
}

function hasWsConfig(): boolean {
  return Boolean(
    process.env.SPARK_APP_ID &&
      process.env.SPARK_API_KEY &&
      process.env.SPARK_API_SECRET,
  );
}

function hasHttpConfig(): boolean {
  return Boolean(process.env.SPARK_API_KEY);
}

export function sparkMode(): SparkMode {
  if (hasWsConfig()) return "spark-ws";
  if (hasHttpConfig()) return "spark-http";
  return "unconfigured";
}

function assertSparkConfigured(): void {
  if (sparkMode() === "unconfigured") {
    throw new Error(
      "未配置真实模型接口。请在 .env 中配置 SPARK_APP_ID、SPARK_API_KEY、SPARK_API_SECRET，或配置 OpenAI 兼容的 SPARK_API_KEY。",
    );
  }
}

function httpBaseUrl(): string {
  return process.env.SPARK_BASE_URL || DEFAULT_HTTP_BASE_URL;
}

function modelForStage(stage: Stage): string {
  let routes: Record<string, string> = {};
  const raw = process.env.MODEL_ROUTES;
  if (raw) {
    try {
      routes = JSON.parse(raw) as Record<string, string>;
    } catch {
      // Keep the default model when route JSON is invalid.
    }
  }
  return routes[stage] || process.env.SPARK_DEFAULT_MODEL || DEFAULT_HTTP_MODEL;
}

function domainForStage(stage: Stage): string {
  let routes: Record<string, string> = {};
  const raw = process.env.SPARK_DOMAIN_ROUTES;
  if (raw) {
    try {
      routes = JSON.parse(raw) as Record<string, string>;
    } catch {
      // Keep the default domain when route JSON is invalid.
    }
  }
  return routes[stage] || process.env.SPARK_DOMAIN || DEFAULT_WS_DOMAIN;
}

export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall through and try to extract the first JSON object.
  }

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(cleaned.slice(first, last + 1)) as T;
  }
  throw new Error("无法从模型输出中解析 JSON");
}

export async function callSpark(opts: CallOptions): Promise<string> {
  const chunks: string[] = [];
  for await (const chunk of streamSpark(opts)) chunks.push(chunk);
  return chunks.join("");
}

export async function* streamSpark(
  opts: CallOptions,
): AsyncGenerator<string, void, unknown> {
  assertSparkConfigured();

  for (let attempt = 0; attempt <= sparkRetryCount(); attempt++) {
    let emitted = false;
    const release = await acquireSparkSlot();
    try {
      const stream = hasWsConfig() ? streamSparkWs(opts) : streamSparkHttp(opts);
      for await (const chunk of stream) {
        emitted = true;
        yield chunk;
      }
      return;
    } catch (err) {
      if (emitted || opts.signal?.aborted || !isRetryableSparkError(err)) {
        throw err;
      }
      if (attempt >= sparkRetryCount()) throw err;
      await delay(sparkBackoffMs(attempt));
    } finally {
      release();
    }
  }
}

async function* streamSparkHttp(
  opts: CallOptions,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${httpBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SPARK_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelForStage(opts.stage),
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      stream: true,
    }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`鏄熺伀 HTTP 鎺ュ彛閿欒 ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const json = JSON.parse(payload);
        const delta = json?.choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        // Skip incomplete SSE frames.
      }
    }
  }
}

function signedWsUrl(): string {
  const endpoint = new URL(process.env.SPARK_WS_URL || DEFAULT_WS_URL);
  const date = new Date().toUTCString();
  const path = `${endpoint.pathname}${endpoint.search}`;
  const signatureOrigin = [
    `host: ${endpoint.host}`,
    `date: ${date}`,
    `GET ${path} HTTP/1.1`,
  ].join("\n");
  const signature = crypto
    .createHmac("sha256", process.env.SPARK_API_SECRET!)
    .update(signatureOrigin)
    .digest("base64");
  const authorization = Buffer.from(
    `api_key="${process.env.SPARK_API_KEY}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`,
  ).toString("base64");

  endpoint.searchParams.set("authorization", authorization);
  endpoint.searchParams.set("date", date);
  endpoint.searchParams.set("host", endpoint.host);
  return endpoint.toString();
}

async function* streamSparkWs(
  opts: CallOptions,
): AsyncGenerator<string, void, unknown> {
  const ws = new WebSocket(signedWsUrl());
  const queue: string[] = [];
  let finished = false;
  let opened = false;
  let error: Error | null = null;
  let notify: (() => void) | null = null;

  const wake = () => {
    notify?.();
    notify = null;
  };

  const close = () => {
    if (
      ws.readyState === WebSocket.OPEN ||
      ws.readyState === WebSocket.CONNECTING
    ) {
      ws.close();
    }
  };

  opts.signal?.addEventListener("abort", () => {
    error = new Error("请求已取消");
    close();
    wake();
  });

  ws.on("open", () => {
    opened = true;
    ws.send(JSON.stringify(buildWsRequest(opts)));
    wake();
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const code = Number(msg?.header?.code ?? 0);
      if (code !== 0) {
        error = new Error(formatSparkWsError(code, msg?.header?.message));
        finished = true;
        close();
        wake();
        return;
      }

      const items = msg?.payload?.choices?.text ?? [];
      for (const item of items) {
        const text = item?.content;
        if (typeof text === "string" && text) queue.push(text);
      }

      const status = Number(msg?.header?.status ?? msg?.payload?.choices?.status);
      if (status === 2) {
        finished = true;
        close();
      }
      wake();
    } catch (err) {
      error = err instanceof Error ? err : new Error(String(err));
      finished = true;
      close();
      wake();
    }
  });

  ws.on("error", (err) => {
    error = err instanceof Error ? err : new Error(String(err));
    finished = true;
    wake();
  });

  ws.on("close", () => {
    if (!opened && !error) error = new Error("星火 WebSocket 连接未能建立");
    finished = true;
    wake();
  });

  while (!finished || queue.length > 0) {
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    if (error) throw error;
    if (finished) break;
    await new Promise<void>((resolve) => {
      notify = resolve;
    });
  }

  if (error) throw error;
}

function buildWsRequest(opts: CallOptions): Record<string, unknown> {
  return {
    header: {
      app_id: process.env.SPARK_APP_ID,
      uid: "learning-multiagent",
    },
    parameter: {
      chat: {
        domain: domainForStage(opts.stage),
        max_tokens: Number(process.env.SPARK_MAX_TOKENS || 4096),
        temperature: opts.temperature ?? 0.7,
        top_k: Number(process.env.SPARK_TOP_K || 5),
        presence_penalty: Number(process.env.SPARK_PRESENCE_PENALTY || 1),
        frequency_penalty: Number(process.env.SPARK_FREQUENCY_PENALTY || 0.02),
        thinking: { type: process.env.SPARK_THINKING || "disabled" },
      },
    },
    payload: {
      message: {
        text: opts.messages,
      },
    },
  };
}

function formatSparkWsError(code: number, message: unknown): string {
  const detail = typeof message === "string" && message.trim() ? message.trim() : "未知错误";
  if (code === 11200 || /AppIdNoAuthError/i.test(detail)) {
    return `星火模型未授权（${code} ${detail}）：当前 AppID 尚未开通所配置的模型能力，请在讯飞控制台开通对应 X1/X2 服务，或把 SPARK_WS_URL/SPARK_DOMAIN 改成已授权的模型。`;
  }
  if (code === 11202 || /QpsOverFlow|qps|overflow/i.test(detail)) {
    return `星火接口限流（${code} ${detail}）：当前 AppID 的请求频率超过额度，系统已自动排队重试；如果仍失败，请稍后再试或提升讯飞控制台 QPS 配额。`;
  }
  return `星火 WebSocket 接口错误 ${code}：${detail}`;
}

async function acquireSparkSlot(): Promise<() => void> {
  const previous = sparkLock;
  let release!: () => void;
  sparkLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  const interval = Number(process.env.SPARK_MIN_INTERVAL_MS || DEFAULT_MIN_INTERVAL_MS);
  const waitMs = Math.max(0, lastSparkStart + interval - Date.now());
  if (waitMs > 0) await delay(waitMs);
  lastSparkStart = Date.now();
  return release;
}

function sparkRetryCount(): number {
  return Number(process.env.SPARK_RETRY_COUNT || DEFAULT_RETRY_COUNT);
}

function sparkBackoffMs(attempt: number): number {
  const base = Number(process.env.SPARK_RETRY_BASE_MS || 3000);
  return Math.min(base * 2 ** attempt, 30_000);
}

function isRetryableSparkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /11202|QpsOverFlow|qps|overflow|rate|timeout|econnreset|network|socket/i.test(
    message,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
