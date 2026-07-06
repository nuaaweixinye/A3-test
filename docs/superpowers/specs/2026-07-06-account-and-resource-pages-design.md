# 设计文档：账号管理 + 资源详情页

> 日期：2026-07-06
> 状态：已批准，待实现

## 1. 背景与目标

当前项目存在两个核心短板：

1. **零持久化**：Zustand store 完全在内存中，刷新即丢失全部画像、学习路径和资源。无账号系统，无数据库。
2. **资源展示扁平**：6 种资源（文档/题库/导图/视频/代码/阅读）全部以 Markdown 文本平铺在 `/learn` 单页面，除视频外无类型专属交互。

本次改动解决这两个问题：

- **账号管理**：Prisma + SQLite + 自定义 JWT（bcryptjs + jose），实现注册/登录/登出/路由保护，画像和学习记录持久化到服务端。
- **资源详情页**：`/learn/[resourceId]` 路由 + 6 种类型专用渲染组件（交互答题、可视化导图、语法高亮等）。

## 2. 数据模型（Prisma Schema）

数据库：SQLite（文件 `prisma/dev.db`），通过 Prisma ORM 管理。

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model User {
  id           String        @id @default(cuid())
  username     String        @unique
  passwordHash String
  createdAt    DateTime      @default(now())

  profile      Profile?
  learnRecords LearnRecord[]
}

model Profile {
  id             String   @id @default(cuid())
  userId         String   @unique
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // StudentProfile 六维（JSON 存储复杂结构）
  knowledgeLevel String   // JSON: Record<string, number>，如 {"数组":80,"链表":50}
  cognitiveStyle String   // visual|auditory|reading|kinesthetic
  errorPatterns  String   // JSON: string[]
  learningGoal   String   // exam|project|research|interest
  learningPace   String   // fast|medium|slow
  interests      String   // JSON: string[]
  updatedAt      DateTime @updatedAt
}

model LearnRecord {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  topic     String
  path      String   // JSON: LearningPath
  resources String   // JSON: ResourceCardState[]
  progress  String   // JSON: Record<string, TopicProgress>
  createdAt DateTime @default(now())
}
```

**设计说明**：

- SQLite 不支持原生 `String[]` 和 `Json` 类型，用 `String` 存 JSON 序列化文本，读写时手动 `JSON.parse/stringify`。
- Profile 与 User 1:1，LearnRecord 与 User 1:N。
- `onDelete: Cascade` 确保删除用户时清理关联数据。

## 3. 认证系统

### 3.1 技术选型

| 组件 | 库 | 用途 |
|------|----|------|
| 密码哈希 | `bcryptjs` | bcrypt 哈希（saltRounds=10） |
| JWT 签发/验证 | `jose` | HS256 签名，httpOnly cookie 传输 |
| ORM | `@prisma/client` + `prisma` | 数据访问 |
| 数据库 | `better-sqlite3` | SQLite 驱动（Prisma 内部使用） |

### 3.2 JWT 设计

```
Header: { alg: HS256, typ: JWT }
Payload: { sub: userId, username, iat, exp }
密钥: process.env.JWT_SECRET（.env 中配置）
有效期: 7 天
Cookie: auth_token=<jwt>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800
```

### 3.3 API 路由

| 路由 | 方法 | 功能 | 请求体 | 返回 |
|------|------|------|--------|------|
| `/api/auth/register` | POST | 注册 | `{ username, password }` | `{ user: { id, username } }` + Set-Cookie |
| `/api/auth/login` | POST | 登录 | `{ username, password }` | `{ user: { id, username } }` + Set-Cookie |
| `/api/auth/logout` | POST | 登出 | — | 清除 Cookie |
| `/api/auth/me` | GET | 当前用户 | — | `{ user: { id, username } }` 或 401 |
| `/api/profile` | GET | 获取画像 | — | `{ profile: StudentProfile }` 或空 |
| `/api/profile` | PUT | 保存画像 | `{ profile: StudentProfile }` | `{ ok: true }` |
| `/api/records` | GET | 记录列表 | — | `{ records: LearnRecord[] }` |
| `/api/records` | POST | 保存记录 | `{ topic, path, resources, progress }` | `{ id }` |

### 3.4 路由保护

`middleware.ts`（根目录）：

- **受保护路由**：`/learn`、`/learn/*`、`/profile`、`/tutor`、`/eval`
- **公开路由**：`/`、`/login`、`/register`
- 逻辑：解析 `auth_token` cookie → 验证 JWT → 失败则 302 重定向 `/login?from=<原路径>`
- API 路由 `/api/profile`、`/api/records` 也需要验证（在 route handler 内检查）

### 3.5 前端认证状态

- Zustand store 增加 `user: { id, username } | null` 和 `setUser` action
- `app/layout.tsx` 在客户端首次挂载时调用 `GET /api/auth/me` 同步登录状态
- 未登录时导航栏显示"登录"按钮；已登录显示用户名 + 登出

## 4. 资源详情页

### 4.1 路由

```
/learn                  概览页（保留现有路径时间线 + 卡片网格，卡片可点击）
/learn/[resourceId]     详情页（从 Zustand store 按 ID 读取 card 数据）
```

### 4.2 类型专用渲染器

#### DocDetail（讲解文档）

- **布局**：左侧目录（从 Markdown H2/H3 提取）+ 右侧正文
- **功能**：阅读进度条（scroll position）、`react-markdown` + `remark-gfm` 渲染、"标记完成"按钮
- **解析**：直接使用 `react-markdown`，TOC 从 `content` 的 `## ` / `### ` 标题正则提取

#### QuizDetail（练习题库）

- **布局**：逐题卡片 + 末尾得分汇总
- **交互**：显示题目 → 用户选择选项 → 即时显示正确/错误 → 全部完成后展示得分和错题回顾
- **解析**：从 Markdown 中提取题目结构。Agent 输出格式预期为：
  ```
  ### 第1题
  题干文本...
  A. 选项A
  B. 选项B
  C. 选项C
  D. 选项D
  **答案：B**
  **解析：...**
  ```
  正则匹配：`/###\s*第\d+题[\s\S]*?(?=###\s*第\d+题|$)/g`，再从每个块提取题干、选项、答案、解析

#### MindmapDetail（思维导图）

- **布局**：居中树状图，根节点 → 分支 → 叶子
- **渲染**：纯 CSS flexbox + 伪元素连线（竖线 + 横线），支持点击折叠/展开子树
- **解析**：从 Markdown 缩进列表提取层级。Agent 输出格式预期为：
  ```
  - 根节点
    - 子节点1
      - 叶子1
      - 叶子2
    - 子节点2
  ```
  按缩进深度（2空格 = 1层）解析为树结构

#### VideoDetail（教学视频）

- **布局**：VideoPlayer（已有组件）居中 + 右侧分镜列表（可点击跳转）
- **顶部**：资源标题 + 主题标签
- **复用**：直接渲染 `<VideoPlayer content={card.content} />`

#### CodeDetail（代码实操）

- **布局**：文件名标签栏 + 代码块 + 复制按钮
- **高亮**：`react-syntax-highlighter`（Prism light build），支持常见语言
- **解析**：从 Markdown 的 ` ```language ` 代码块提取代码和语言

#### ReadingDetail（拓展阅读）

- **布局**：外链卡片网格
- **功能**：每张卡片显示标题 + 摘要 + "阅读"外链按钮 + "已读"勾选
- **解析**：从 Markdown 提取链接和描述

### 4.3 详情页通用布局

```
ResourceDetailLayout
├── Header: ← 返回 / 类型徽章 + 标题 / 主题标签
├── Content: [类型专用渲染器]
└── Footer: 掌握度滑块 / 事实核查折叠 / 引用来源
```

- 从 `ResourceCard` 拆出通用的 footer（掌握度 + 事实核查 + 引用）到 `ResourceDetailLayout`
- `/learn` 概览页的卡片保留简化版 footer（仅进度指示）

### 4.4 概览页 `/learn` 改进

- 左侧时间线：当前 topic 高亮，已完成打勾（检查对应 resources 是否全部 `done`）
- 右侧卡片：整个卡片可点击 → `router.push('/learn/${card.id}')`
- 卡片 hover 效果（shadow + border 高亮）
- 空状态：引导先到首页对话

## 5. 持久化集成

### 5.1 持久化时机

| 事件 | 触发动作 |
|------|----------|
| 注册/登录成功 | `GET /api/profile` + `GET /api/records?limit=1` → 写入 Zustand store |
| profile SSE 事件（画像更新） | 防抖 3s → `PUT /api/profile`（仅 user 已登录时） |
| eval apply（评估回写） | 立即 `PUT /api/profile` |
| SSE done（学习完成） | `POST /api/records` 保存完整学习结果 |
| 掌握度变更 | 标记 dirty flag，随下一次 profile 同步一起提交 |

### 5.2 Store 改动

`useLearningStore` 新增：

```typescript
user: { id: string; username: string } | null;
setUser: (user) => void;

// 持久化辅助
syncProfile: () => Promise<void>;  // PUT /api/profile（防抖）
saveRecord: (topic: string) => Promise<void>;  // POST /api/records
loadUserData: () => Promise<void>;  // 登录后加载
```

### 5.3 数据一致性

- **主真源**：Zustand store（内存）为前端真源；数据库为持久化备份。
- **写入**：store 变更 → 异步同步到 DB（不阻塞 UI）。
- **读取**：登录时从 DB 加载到 store；之后所有操作基于 store。
- **冲突**：单用户单设备场景，不考虑并发冲突。

## 6. 导航 UI

### 6.1 导航栏

- 增加 `usePathname()` 实现当前路由高亮（底部蓝色边框）
- 右侧用户区域：
  - 未登录：`[登录]` 按钮 → `/login`
  - 已登录：`👤 用户名 ▾` 下拉 → 画像链接 / 登出
- `/login` 和 `/register` 页面使用独立布局（无导航栏）

### 6.2 登录/注册页面

- 全屏居中卡片式表单
- Tab 切换：登录 / 注册
- 登录：用户名 + 密码
- 注册：用户名 + 密码 + 确认密码
- 表单验证：用户名 2-20 字符，密码 ≥ 6 字符
- 错误提示：用户名已存在 / 密码错误 / 等

## 7. 新增依赖

```json
{
  "dependencies": {
    "@prisma/client": "^6.0.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.0.0",
    "react-syntax-highlighter": "^15.6.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
      "@types/bcryptjs": "^2.4.6",
    "@types/react-syntax-highlighter": "^15.5.13"
  }
}
```

## 8. 新增文件清单

```
prisma/
  schema.prisma                         数据模型
  dev.db                                SQLite 文件（.gitignore）

backend/auth/
  jwt.ts                                JWT 签发/验证（jose）
  password.ts                           bcryptjs 哈希/验证
  prisma.ts                             Prisma client 单例
  session.ts                            从请求解析当前用户

app/
  login/page.tsx                        登录/注册页面
  middleware.ts                          路由保护
  learn/[resourceId]/page.tsx           资源详情页路由
  api/auth/register/route.ts
  api/auth/login/route.ts
  api/auth/logout/route.ts
  api/auth/me/route.ts
  api/profile/route.ts                  GET/PUT 画像
  api/records/route.ts                  GET/POST 学习记录

frontend/components/auth/
  UserMenu.tsx                          导航栏用户下拉

frontend/components/resource/detail/
  ResourceDetailLayout.tsx              通用布局壳
  DocDetail.tsx
  QuizDetail.tsx
  MindmapDetail.tsx
  VideoDetail.tsx
  CodeDetail.tsx
  ReadingDetail.tsx
```

## 9. 环境变量

`.env` 新增：

```
JWT_SECRET=<随机32位字符串>
DATABASE_URL="file:./dev.db"
```

`.env.example` 同步更新。

## 10. Docker 适配

- `Dockerfile` 增加 `npx prisma generate` 步骤
- `next.config.ts` 的 `outputFileTracingIncludes` 增加 `./prisma/**/*`
- `docker-compose.yml` 挂载 `prisma/dev.db` volume 实现持久化

## 11. 不做的事情（YAGNI）

- OAuth 第三方登录（GitHub/微信等）——比赛不需要
- 邮箱注册/验证 ——用户名即可
- 密码重置/找回 ——单机演示场景
- 多设备并发同步 ——不考虑
- 资源评论/社交功能 ——超出范围
- 管理员后台 ——不需要
