# 开源标注与 AI 工具说明

> 赛题要求：使用开源项目须标注名称、来源及协议；AI 辅助工具须选用科大讯飞相关工具；如使用 AI Coding 工具需给出说明。
> 版本：v1.0　日期：2026-07

---

## 1. 开源依赖标注

| 项目 | 版本 | 来源 | 协议 | 用途 |
| --- | --- | --- | --- | --- |
| THU-MAIC/**OpenMAIC** | v0.3.0（架构参考） | https://github.com/THU-MAIC/OpenMAIC | MIT | 架构参考：多智能体编排、场景系统思路（本项目从零实现，未直接包含其代码） |
| **@langchain/langgraph** | 1.4.7 | https://github.com/langchain-ai/langgraphjs | MIT | 多智能体状态图编排（StateGraph） |
| @langchain/core | 1.2.1 | https://github.com/langchain-ai/langchainjs | MIT | LangChain 核心（被 langgraph 依赖） |
| **Next.js** | 16.2.10 | https://github.com/vercel/next.js | MIT | 全栈应用框架（App Router） |
| **React** | 19.2.4 | https://github.com/facebook/react | MIT | UI 库 |
| TypeScript | ^5 | https://github.com/microsoft/TypeScript | Apache-2.0 | 类型系统 |
| **Tailwind CSS** | ^4 | https://github.com/tailwindlabs/tailwindcss | MIT | 原子化 CSS |
| shadcn/ui 思路 | — | https://ui.shadcn.com | MIT | UI 组件组织方式参考（按需手写） |
| **ECharts** | ^6 | https://github.com/apache/echarts | Apache-2.0 | 画像/评估数据可视化（雷达图） |
| **Zustand** | ^5 | https://github.com/pmndrs/zustand | MIT | 前端状态管理 |
| **react-markdown** | latest | https://github.com/remarkjs/react-markdown | MIT | 资源 Markdown 渲染 |
| remark-gfm | latest | https://github.com/remarkjs/remark-gfm | MIT | GFM 表格/列表支持 |
| nanoid | ^5 | https://github.com/ai/nanoid | MIT | 资源/消息 ID 生成 |
| zod | ^3 | https://github.com/colinhacks/zod | MIT | 运行时校验 |
| ESLint | ^9 | https://github.com/eslint/eslint | MIT | 代码规范（flat config） |

> 均为成熟开源项目，许可证兼容，已在本文件显著位置标注。

---

## 2. 科大讯飞（出题企业）工具使用说明

赛题硬性要求"AI 辅助工具须选用科大讯飞相关工具"。本项目使用情况：

### 2.1 讯飞星火大模型（已接入）
- **接入方式**：通过讯飞开放平台提供的 **OpenAI 兼容端点** `https://spark-api-open.xf-yun.com/v1/chat/completions`。
- **鉴权**：`Authorization: Bearer <SPARK_API_KEY>`（控制台生成的接口密钥/APIPassword）。
- **分阶段模型路由**（`lib/ai/spark.ts`）：画像抽取用 `lite`，资源生成/辅导用 `4.0Ultra`，评估用 `pro`，由 `MODEL_ROUTES` 环境变量配置。
- **流式**：直接解析星火 SSE（`data: {chunk}` / `data: [DONE]`），逐 token 推送到前端。
- **配置位置**：`.env` 的 `SPARK_API_KEY`（见 `.env.example`）。

### 2.2 讯飞 TTS（预留，待接入）
- 视频/辅导当前使用**浏览器 Web Speech API** 作为占位配音。
- 已在 `spark.ts` 与文档中预留 `TTS_SPARK_*` 配置位；获得 TTS 密钥后替换 `SpeakButton` 实现即可切换为讯飞语音合成（满足赛题对讯飞工具的要求）。

### 2.3 mock 兜底
- 未配置 `SPARK_API_KEY` 时，系统自动进入 **mock 模式**，按各资源类型/画像/路径/辅导/评估输出结构化占位内容，保障无密钥环境下亦可端到端演示与测试。

---

## 3. AI Coding 工具使用说明

- 本项目开发过程中使用了 **AI 编程辅助工具**（基于大模型的命令行编程助手）辅助：脚手架搭建、代码生成、重构、调试与文档撰写。
- 所有 AI 生成代码均经人工审阅、类型检查（`tsc`）、代码规范检查（`eslint`）与运行时验证（见《测试说明书.md》）后纳入。
- 运行时的大模型能力（画像/资源/辅导/评估生成）由**科大讯飞星火**提供，与开发期的 AI Coding 工具相互独立。

---

## 4. 合规声明
- 全部依赖均为开源且按协议（MIT/Apache-2.0）使用，已标注来源；
- 大模型推理调用科大讯飞星火；
- 无任何闭源/受限组件。
