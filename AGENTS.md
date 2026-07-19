<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: 智学多智能体

## Commands
- Dev: `npm run dev` (Turbopack, port 3000)
- Build: `npm run build` (standalone output enabled)
- Run standalone: `node .next/standalone/server.js` (set `PORT` when needed)
- Lint: `npm run lint`
- Typecheck: `npx tsc --noEmit`
- Package Windows: `npm run package:win`
- Docker: `docker compose up --build` (requires real Spark credentials)

## Key Conventions
- Full-stack Next.js app. Server logic lives in `backend/`, client components and store live in `frontend/`, and routes live in `app/`.
- Multi-agent orchestration uses LangGraph.js in `backend/graph.ts`.
- LLM calls use 科大讯飞星火 X1/X2 WebSocket first, with OpenAI-compatible HTTP as fallback when explicitly configured.
- Missing model credentials fail fast. The app only uses real model generation.
- Resource generation uses RAG context, AI supplement when the knowledge base is incomplete, fact checking, and cross-agent review.
- Generated MP4 files are written to `public/generated-videos/`.
- Generated PPT files are written to `public/generated-ppts/`.
- Import paths use `@/backend/*` and `@/frontend/*`.
