# 智学多智能体 · 个性化学习系统

> 第十五届中国软件杯 **A3** 赛题：**基于大模型的个性化资源生成与学习多智能体系统开发**（出题企业：科大讯飞）

一个基于大模型与**多智能体协同框架**的个性化学习系统。学生通过自然语言对话，系统自动构建 6 维度学习画像、规划学习路径，并基于课程知识库（**数据结构与算法**）生成讲解文档，全程流式呈现并带防幻觉引用。

> 架构参考 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) (MIT)，技术栈简化为 **Next.js 全栈单语言**（去掉了原指南的 Python 后端）。

---

## 最小闭环已实现（本次交付）

```
用户对话 → 画像构建Agent → 路径规划Agent → 文档生成Agent → 流式展示
```

| 赛题功能 | 状态 | 实现位置 |
| --- | --- | --- |
| ① 对话式学习画像构建（≥6 维度） | ✅ | `lib/agents/profile-agent.ts` |
| ② 多智能体协同资源生成（6 类并行） | ✅ 全部 | doc/quiz/mindmap/video/code/reading Agent，LangGraph 并行分发 |
| ③ 个性化学习路径规划与推送 | ✅ | `lib/agents/planner-agent.ts` |
| ④ 智能辅导（加分项） | ⏳ 待扩展 | — |
| ⑤ 学习效果评估（加分项） | ⏳ 待扩展 | — |
| 防幻觉 + 内容安全 | ✅ 第 1/2/4 层 | `lib/knowledge/retriever.ts`、Prompt 约束、引用标注 |

## 技术栈

- **Next.js 16**（App Router + Turbopack）+ **React 19** + **TypeScript 5** —— 全栈单语言
- **LangGraph.js**（`@langchain/langgraph`）—— **多智能体协同框架**（StateGraph 编排）
- **科大讯飞星火**大模型 —— OpenAI 兼容端点 `https://spark-api-open.xf-yun.com/v1`
- **最小 RAG**：关键词重叠检索（零依赖、免密钥即可运行；后续可换 Chroma + BGE-M3）
- **Tailwind CSS v4** + **ECharts**（画像雷达）+ **react-markdown**（文档渲染）+ **Zustand**（前端状态）
- **SSE 流式**：基于 Web `ReadableStream`，前后端自定义事件协议

## 快速开始

```bash
npm install
cp .env.example .env   # 暂不填密钥也能跑（mock 模式）
npm run dev            # http://localhost:3000
```

### 接入讯飞星火（真实大模型）

1. 访问 https://www.xfyun.cn/ 注册并创建"星火大模型"应用，获取 **APIKey**。
2. 填入 `.env` 的 `SPARK_API_KEY`，系统自动从 mock 切换为真实调用。
3. 可在 `MODEL_ROUTES` 中为不同阶段配置不同模型（画像用 `lite`，生成用 `4.0Ultra`）。

## 多智能体协同框架

`lib/graph.ts` 用 **LangGraph StateGraph** 编排 8 个角色智能体，共享状态在节点间流转：

```
START → profile_builder（画像构建Agent） → path_planner（路径规划Agent）
      ┌─→ doc_gen       ┌─→ quiz_gen      ┌─→ mindmap_gen     （6 个资源 Agent 并行）
      └─→ video_gen      └─→ code_gen      └─→ reading_gen
      → resources 通道加法聚合 → END
```

- 规划完成后**并行分发**到 6 个资源 Agent（满足赛题"多智能体协同"），产物在 `resources` 通道加法聚合。
- 各资源节点通过注入的 `emit` 回调把 `resource_start` / `resource_delta` / `resource` 事件**逐 token 流式推送**到 SSE 通道。
- 视频资源附带"▶ 语音播放"按钮：前端用浏览器内置语音合成朗读旁白（占位配音，接入讯飞 TTS 后替换）。
- 各资源 Agent 经共享 `resource-runner` 统一完成「RAG 检索 → 星火流式 → 事件推送」。

## 防幻觉机制（4 层，赛题非功能性要求）

1. **检索约束**：所有生成前先检索知识库，作为 Prompt 上下文（`lib/knowledge/retriever.ts`）。
2. **Prompt 约束**：System Prompt 强制"仅基于知识库内容生成，不得编造"。
3. **事实核查**：（待扩展）生成后交叉验证。
4. **引用标注**：文档标注来源（`sources`），便于评审验证。

## 目录结构

```
app/
  api/learn/route.ts        SSE 流式闭环接口（画像→路径→6 资源并行）
  page.tsx                  首页：对话入口
  profile/page.tsx          画像雷达 + 6 维度详情
  learn/page.tsx            学习路径时间线 + 资源画廊
components/
  chat/ChatPanel.tsx        对话面板（驱动闭环、解析 SSE、资源进度）
  profile/ProfileRadar.tsx  ECharts 6 轴雷达图
  resource/DocView.tsx      Markdown 渲染
  resource/ResourceCard.tsx 统一资源卡片（含视频语音播放）
lib/
  ai/spark.ts               星火客户端（兼容端点 + 分阶段路由 + 按类型 mock）
  agents/                   画像/规划 + 6 个资源 Agent + resource-runner 共享运行器
  graph.ts                  LangGraph 多智能体编排（并行分发）
  knowledge/retriever.ts    最小 RAG 检索
  store/useLearningStore.ts Zustand 全局状态
  sse-client.ts             浏览器 SSE 消费
  types/index.ts            公共类型
knowledge_base/             课程知识库（数据结构与算法，8 篇种子文档）
```

## 路线图（向完整赛题系统扩展）

- [x] 资源生成 Agent 覆盖 6 类：doc/quiz/mindmap/video/code/reading（LangGraph 并行分发）
- [ ] 接入讯飞 TTS 替换浏览器占位语音（加分项 ④ 智能辅导）
- [ ] 加分项 ⑤ 学习效果评估 Agent + 动态路径调整
- [ ] RAG 升级为 Chroma + BGE-M3 向量检索；补齐防幻觉第 3 层事实核查
- [ ] 画像持久化（PostgreSQL）、会话缓存（Redis）
- [ ] Docker Compose 部署、文档与演示视频

## 开源依赖标注（赛题要求）

| 项目 | 用途 | 协议 |
| --- | --- | --- |
| THU-MAIC/OpenMAIC | 架构参考（多智能体编排、场景系统思路） | MIT |
| @langchain/langgraph | 多智能体状态图编排 | MIT |
| Next.js / React | 全栈框架 | MIT |
| Tailwind CSS / ECharts / Zustand | UI、可视化、状态管理 | MIT / Apache-2.0 / MIT |
| react-markdown | Markdown 渲染 | MIT |

> 大模型与 AI 工具：**科大讯飞星火大模型**（OpenAI 兼容接口）。
