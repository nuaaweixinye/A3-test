# 智学多智能体

面向软件杯 A3 赛题的个性化学习资源生成系统。系统通过自然语言对话构建学习画像，规划个性化学习路径，并由多智能体协同生成资源设计/PPT、讲解文档、题库、思维导图、教学视频、代码实操和拓展阅读。

## 主要功能

- 对话式学习画像：自动抽取知识基础、认知风格、易错点、学习目标、学习节奏、兴趣方向等维度。
- 多智能体资源生成：Profile、Planner、Design/PPT、Doc、Quiz、Mindmap、Video、Code、Reading、CrossCheck、Synthesis 等角色协同。
- 知识库增强：优先基于知识库生成；知识库不足时，AI 按提示词和已有知识库补全，并标注补全部分。
- 学习路径规划：按画像、进度和薄弱点动态组织资源顺序。
- 学习记录与评估：保存历史学习记录，支持删除记录，支持掌握度反馈和画像回写。
- 真文件生成：视频资源自动生成带旁白音轨的 MP4；资源设计自动生成可下载 `.pptx`。

## 快速开始

```bash
npm install
cp .env.example .env
npm run dev
```

访问：

```text
http://localhost:3000
```

## 环境变量

系统需要真实模型接口，缺少密钥会直接报错。

```env
SPARK_APP_ID=
SPARK_API_KEY=
SPARK_API_SECRET=
SPARK_WS_URL=wss://spark-api.xf-yun.com/x2
SPARK_DOMAIN=spark-x
```

视频生成需要 ffmpeg：

```env
FFMPEG_PATH=C:\path\to\ffmpeg.exe
```

## 常用命令

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run package:win
```

## 目录

```text
app/        Next.js 页面和 API 路由
backend/    多智能体、模型调用、知识库、视频/PPT 渲染
frontend/   组件、状态管理、SSE 客户端
prisma/     SQLite 数据模型
scripts/    Windows 打包脚本
```
