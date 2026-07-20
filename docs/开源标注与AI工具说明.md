# 开源标注与 AI 工具说明

> 赛题要求：使用开源项目须标注名称、来源及协议；AI 辅助工具须选用科大讯飞相关工具。
> 版本：v2.0　日期：2026-07

---

## 1. 开源依赖标注

### 核心框架
| 项目 | 版本 | 来源 | 协议 | 用途 |
| --- | --- | --- | --- | --- |
| THU-MAIC/**OpenMAIC** | v0.3.0（架构参考） | https://github.com/THU-MAIC/OpenMAIC | MIT | 架构参考（从零实现，未含其代码） |
| **Next.js** | 16.2.10 | https://github.com/vercel/next.js | MIT | 全栈应用框架（App Router） |
| **React** | 19.2.4 | https://github.com/facebook/react | MIT | UI 库 |
| **@langchain/langgraph** | 1.4.7 | https://github.com/langchain-ai/langgraphjs | MIT | 多智能体状态图编排 |
| @langchain/core | 1.2.1 | https://github.com/langchain-ai/langchainjs | MIT | LangChain 核心 |
| TypeScript | ^5 | https://github.com/microsoft/TypeScript | Apache-2.0 | 类型系统 |

### 前端
| 项目 | 版本 | 来源 | 协议 | 用途 |
| --- | --- | --- | --- | --- |
| **Tailwind CSS** | ^4 | https://github.com/tailwindlabs/tailwindcss | MIT | 原子化 CSS |
| **ECharts** | ^6 | https://github.com/apache/echarts | Apache-2.0 | 雷达图/折线图/趋势图 |
| echarts-for-react | ^3 | https://github.com/hustcc/echarts-for-react | MIT | ECharts React 封装 |
| **Zustand** | ^5 | https://github.com/pmndrs/zustand | MIT | 前端状态管理 |
| **react-markdown** | ^10 | https://github.com/remarkjs/react-markdown | MIT | Markdown 渲染 |
| remark-gfm | ^4 | https://github.com/remarkjs/remark-gfm | MIT | GFM 表格/列表 |
| **react-syntax-highlighter** | ^15 | https://github.com/react-syntax-highlighter/react-syntax-highlighter | MIT | 代码语法高亮 |
| **markmap-view** + **markmap-lib** | latest | https://github.com/markmap/markmap | MIT | 思维导图 SVG 放射状可视化 |
| **dompurify** | latest | https://github.com/cure53/DOMPurify | Apache-2.0/MPL-2.0 | SVG XSS 消毒 |

### 后端/数据
| 项目 | 版本 | 来源 | 协议 | 用途 |
| --- | --- | --- | --- | --- |
| **Prisma** + **@prisma/client** | ^6 | https://github.com/prisma/prisma | Apache-2.0 | ORM |
| better-sqlite3 | (Prisma 内置) | https://github.com/WiseLibs/better-sqlite3 | MIT | SQLite 驱动 |
| **bcryptjs** | ^2 | https://github.com/dcodeIO/bcrypt.js | Apache-2.0 | 密码哈希 |
| **jose** | ^5 | https://github.com/panva/jose | MIT | JWT 签发/验证 |
| nanoid | ^5 | https://github.com/ai/nanoid | MIT | ID 生成 |
| ESLint | ^9 | https://github.com/eslint/eslint | MIT | 代码规范 |

> 均为成熟开源项目，许可证兼容（MIT/Apache-2.0），已标注。

---

## 2. 科大讯飞工具使用说明

### 2.1 讯飞星火大模型（已接入）
- **端点**：OpenAI 兼容 `https://spark-api-open.xf-yun.com/v1/chat/completions`
- **鉴权**：`Authorization: Bearer <SPARK_API_KEY>`
- **模型路由**：画像用 `generalv3.5`，资源生成/辅导/评估用 `4.0Ultra`
- **流式**：解析星火 SSE，逐 token 推送前端
- **配置**：`.env` 的 `SPARK_API_KEY`

### 2.2 讯飞 ChatDoc 知识库（已接入）
- **功能**：云端语义检索 + 事实核查
- **鉴权**：HMAC-SHA1 签名（`backend/knowledge/spark-auth.ts`）
- **检索**：`search(query, topK)` → 语义检索最相关文档片段
- **核查**：`factCheck(content, topic)` → 交叉验证事实声明
- **管理**：`uploadFile()` / `listFiles()` — 前端 `/knowledge` 页面可视化操作
- **配置**：`.env` 的 `SPARK_APP_ID` / `SPARK_API_SECRET` / `SPARK_KB_REPO_ID`

### 2.3 mock 兜底
未配置密钥时，系统自动进入 mock 模式，输出结构化占位内容。

---

## 3. AI Coding 工具使用说明

- 开发过程使用了 **AI 编程辅助工具**（基于大模型的命令行编程助手），辅助脚手架搭建、代码生成、重构、调试与文档撰写。
- 所有 AI 生成代码均经人工审阅、`tsc` 类型检查、`eslint` 规范检查与运行时验证后纳入。
- 运行时的大模型能力由**科大讯飞星火**提供，与开发期 AI Coding 工具相互独立。

---

## 4. 合规声明
- 全部依赖均为开源且按协议（MIT/Apache-2.0）使用，已标注来源；
- 大模型推理 + 知识库 RAG + 事实核查均调用科大讯飞服务；
- 无任何闭源/受限组件。
