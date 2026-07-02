<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: 智学多智能体 (A3 软件杯)

## Commands
- Dev: `npm run dev` (Turbopack, port 3000)
- Build: `npm run build`
- Lint: `npm run lint` (ESLint flat config; `next lint` is removed in Next 16)
- Typecheck: `npx tsc --noEmit`

## Key conventions
- Single-language Next.js full-stack app (no separate Python backend).
- Multi-agent orchestration via **LangGraph.js** in `lib/graph.ts`. Node names must NOT collide with state channel names (e.g. don't name a node `profile` when a channel is `profile`) — LangGraph throws at compile time.
- LLM = 科大讯飞星火 via OpenAI-compatible endpoint. When `SPARK_API_KEY` is unset, `lib/ai/spark.ts` runs in **mock mode** so the UI works without keys.
- Streaming = raw `ReadableStream` SSE in `app/api/learn/route.ts` (not AI SDK). Event protocol type: `lib/types.ts` `AgentEvent`.
- Reading files at runtime (e.g. `knowledge_base/*.md`) is OK — route handlers run on Node.js runtime.

