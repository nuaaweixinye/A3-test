# 团队协作规范（CONTRIBUTING）

> 适用：软件杯 A3「学习多智能体系统」三人并行开发
> 模式：三台机器、共享一个 GitHub 仓库、分支 + PR 协作

---

## 1. 协作模型

- 共享仓库：`git@github.com:nuaaweixinye/A3-test.git`（远程名 `origin`，默认分支 `main`）
- 三人都是 **collaborator**（仓库 Settings → Collaborators 互相邀请）
- 每人各自 `clone` 一份到本机，独立运行 `npm run dev`（各机互不干扰）
- **不直接推 `main`**：所有改动走 feature 分支 → PR → review → 合并

## 2. 分支命名

| 前缀 | 用途 | 示例 |
| --- | --- | --- |
| `feature/` | 新功能 | `feature/spark-real-key` |
| `fix/` | 修 bug | `fix/eval-weak-empty` |
| `docs/` | 文档 | `docs/demo-video-script` |
| `test/` | 测试 | `test/agents-unit` |
| `chore/` | 构建/配置/杂项 | `chore/docker-tweak` |

分支**小而短**（一两天合并），降低冲突。

## 3. 标准工作流（每个任务）

```bash
# 1. 拉最新主干
git checkout main && git pull --rebase

# 2. 建分支
git checkout -b feature/你的任务名

# 3. 改代码……改完自检必过
npx tsc --noEmit && npm run lint && npm run build

# 4. 提交
git add -A
git commit -m "feat: 简短中文描述"

# 5. 推并提 PR
git push -u origin feature/你的任务名
# 去 GitHub 网页点「Compare & pull request」，@一位队友 review
```

合并方式：建议 **Squash merge**，再删分支。

## 4. 主干保护（建议在 GitHub 设置一次）

仓库 **Settings → Branches → Add rule**：
- Branch name pattern：`main`
- ✅ Require a pull request before merging（至少 1 个 approval）
- ✅ Require status checks to pass（tsc/lint/build，配好 CI 后启用）

## 5. 模块归属表（降低冲突，按目录切）

| 角色 | 主要改动的目录 | 示例任务 |
| --- | --- | --- |
| 🅰 后端/智能体 | `lib/agents/*`、`lib/ai/*`、`lib/knowledge/*`、`knowledge_base/`、`lib/graph.ts` | 星火联调、Prompt、知识库扩写 |
| 🅱 前端/交互 | `components/*`、`app/**/page.tsx`、`app/globals.css`、`lib/store/*`、`lib/sse-client.ts` | 响应式、多轮历史、渲染 |
| 🅲 工程/交付 | `tests/*`、`docs/*`、`Dockerfile`、`docker-compose.yml`、`next.config.ts`、根目录脚本 | 单测、文档、视频、部署 |

> 角色可轮换；原则是**当前任务尽量落在自己目录里**。

## 6. 共享接口冻结（重要）

以下文件是**三人共用的契约**，**不要擅自改**，确需改动先在群里/issue 报备，统一由一人改并通知：
- `lib/types/index.ts`（类型 + SSE 事件协议）
- API 契约：`/api/learn`、`/api/tutor`、`/api/eval` 的请求/响应结构
- `.env.example`（环境变量约定）

## 7. 提交信息规范

`<类型>: <中文描述>`，类型：`feat` / `fix` / `docs` / `test` / `chore` / `refactor` / `perf`。
- 一个提交做一件事；大任务拆多个提交。
- 示例：`feat: 辅导多轮历史用 localStorage 持久化`

## 8. 密钥与安全

- `.env` 已被 `.gitignore` 忽略，**密钥永不入库**
- 讯飞星火 `SPARK_API_KEY`：各自申请，或拿到后在群里私下传；放进自己机器的 `.env`
- 提交前自检：`git status` 确认没有 `.env`、没有真实密钥字符串

## 9. 每日协作纪律

- 起手第一件事：`git fetch && git rebase origin/main`（把主干最新合进自己分支）
- 冲突优先在自己分支解决，不要在 `main` 上解
- PR 当天提、当天审；卡住就在群里喊

## 10. 本地运行

```bash
npm install
npm run dev          # http://localhost:3000
# 同一台机器若多人同时跑，改端口：$env:PORT="3001"; npm run dev
```

详见 `docs/并行启动指南.md`；任务清单见 `docs/任务看板.md`。
