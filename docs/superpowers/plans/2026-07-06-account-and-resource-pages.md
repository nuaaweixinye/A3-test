# 账号管理 + 资源详情页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user accounts with JWT auth + SQLite persistence, and create dedicated detail pages with specialized renderers for each of the 6 resource types.

**Architecture:** Prisma + SQLite for storage, bcryptjs + jose for JWT auth in httpOnly cookies, Next.js middleware for route protection. Resource detail pages at `/learn/[resourceId]` with per-type interactive components.

**Tech Stack:** Prisma 6, better-sqlite3, bcryptjs, jose, react-syntax-highlighter, Next.js 16 App Router

---

## File Structure

### New Files

```
prisma/schema.prisma                              Prisma data model
backend/auth/prisma.ts                            Prisma client singleton
backend/auth/password.ts                          bcryptjs hash/verify
backend/auth/jwt.ts                               JWT sign/verify + COOKIE_NAME
backend/auth/session.ts                           getCurrentUser (cookie → DB)
middleware.ts                                     Route protection (edge)
app/login/page.tsx                                Login/register page
app/api/auth/register/route.ts                    POST register
app/api/auth/login/route.ts                       POST login
app/api/auth/logout/route.ts                      POST logout
app/api/auth/me/route.ts                          GET current user
app/api/profile/route.ts                          GET/PUT profile
app/api/records/route.ts                          GET/POST learn records
app/learn/[resourceId]/page.tsx                   Resource detail route
frontend/components/auth/UserMenu.tsx             Nav user dropdown
frontend/components/resource/detail/ResourceDetailLayout.tsx
frontend/components/resource/detail/DocDetail.tsx
frontend/components/resource/detail/QuizDetail.tsx
frontend/components/resource/detail/MindmapDetail.tsx
frontend/components/resource/detail/CodeDetail.tsx
frontend/components/resource/detail/ReadingDetail.tsx
frontend/components/resource/detail/VideoDetail.tsx
```

### Modified Files

```
package.json                  Add deps + postinstall prisma generate
.env / .env.example           Add JWT_SECRET + DATABASE_URL
app/layout.tsx                Active nav links + UserMenu + client auth sync
app/learn/page.tsx            Clickable cards → /learn/[id]
frontend/lib/store/useLearningStore.ts  Add user state + persistence
frontend/components/chat/ChatPanel.tsx   Wire done → saveRecord
frontend/components/resource/ResourceCard.tsx  Card click navigation
Dockerfile                    prisma generate step
next.config.ts                outputFileTracingIncludes for prisma
```

---

## Phase 1: Auth + DB Infrastructure

### Task 1: Dependencies + Prisma Setup

**Files:**
- Modify: `package.json`
- Create: `prisma/schema.prisma`
- Modify: `.env`, `.env.example`

- [ ] **Step 1: Install dependencies**

```bash
npm install @prisma/client bcryptjs jose react-syntax-highlighter
npm install -D prisma @types/bcryptjs @types/react-syntax-highlighter
```

- [ ] **Step 2: Add postinstall script to package.json**

Add to `"scripts"`:
```json
"postinstall": "prisma generate"
```

- [ ] **Step 3: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
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

  knowledgeLevel String   @default("{}")
  cognitiveStyle String   @default("visual")
  errorPatterns  String   @default("[]")
  learningGoal   String   @default("interest")
  learningPace   String   @default("medium")
  interests      String   @default("[]")
  updatedAt      DateTime @updatedAt
}

model LearnRecord {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  topic     String
  path      String   @default("{}")
  resources String   @default("[]")
  progress  String   @default("{}")
  createdAt DateTime @default(now())
}
```

- [ ] **Step 4: Add env vars to `.env` and `.env.example`**

Append to `.env`:
```
# Auth
JWT_SECRET=zhixue-multiagent-jwt-secret-2026
DATABASE_URL="file:./dev.db"
```

Append to `.env.example`:
```
# Auth (generate a random 32+ char string for JWT_SECRET in production)
JWT_SECRET=change-me-to-a-random-string
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 5: Generate Prisma client + create DB**

```bash
npx prisma generate
npx prisma db push
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors. Verify `prisma/dev.db` file was created.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: Prisma + SQLite + auth dependencies setup"
```

---

### Task 2: Auth Utility Files

**Files:**
- Create: `backend/auth/prisma.ts`
- Create: `backend/auth/password.ts`
- Create: `backend/auth/jwt.ts`
- Create: `backend/auth/session.ts`

- [ ] **Step 1: Create `backend/auth/prisma.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 2: Create `backend/auth/password.ts`**

```typescript
import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

- [ ] **Step 3: Create `backend/auth/jwt.ts`**

```typescript
import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "auth_token";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production",
);

export interface JwtPayload {
  sub: string;
  username: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub!,
      username: payload.username as string,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create `backend/auth/session.ts`**

```typescript
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "./jwt";
import { prisma } from "./prisma";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true },
  });
  return user;
}

/** Serialize cookie header for Set-Cookie response */
export function serializeAuthCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7;
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function serializeClearCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: auth utilities (prisma client, password hash, JWT, session)"
```

---

### Task 3: Auth API Routes

**Files:**
- Create: `app/api/auth/register/route.ts`
- Create: `app/api/auth/login/route.ts`
- Create: `app/api/auth/logout/route.ts`
- Create: `app/api/auth/me/route.ts`

- [ ] **Step 1: Create `app/api/auth/register/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { hashPassword } from "@/backend/auth/password";
import { signToken } from "@/backend/auth/jwt";
import { serializeAuthCookie } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
  }
  if (username.length < 2 || username.length > 20) {
    return NextResponse.json({ error: "用户名长度需 2-20 字符" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密码至少 6 个字符" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { username, passwordHash: await hashPassword(password) },
  });

  const token = await signToken({ sub: user.id, username: user.username });
  const headers = new Headers();
  headers.append("Set-Cookie", serializeAuthCookie(token));

  return NextResponse.json(
    { user: { id: user.id, username: user.username } },
    { headers },
  );
}
```

- [ ] **Step 2: Create `app/api/auth/login/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { verifyPassword } from "@/backend/auth/password";
import { signToken } from "@/backend/auth/jwt";
import { serializeAuthCookie } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }

  const token = await signToken({ sub: user.id, username: user.username });
  const headers = new Headers();
  headers.append("Set-Cookie", serializeAuthCookie(token));

  return NextResponse.json(
    { user: { id: user.id, username: user.username } },
    { headers },
  );
}
```

- [ ] **Step 3: Create `app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { serializeClearCookie } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function POST() {
  const headers = new Headers();
  headers.append("Set-Cookie", serializeClearCookie());
  return NextResponse.json({ ok: true }, { headers });
}
```

- [ ] **Step 4: Create `app/api/auth/me/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user });
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors.

- [ ] **Step 6: Manual test (after Task 5 middleware)**

Deferred to after middleware + env are set up.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: auth API routes (register, login, logout, me)"
```

---

### Task 4: Profile + Records API Routes

**Files:**
- Create: `app/api/profile/route.ts`
- Create: `app/api/records/route.ts`

- [ ] **Step 1: Create `app/api/profile/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";
import type { StudentProfile } from "@/backend/types";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const row = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!row) {
    return NextResponse.json({ profile: null });
  }

  const profile: StudentProfile = {
    knowledge_level: JSON.parse(row.knowledgeLevel),
    cognitive_style: row.cognitiveStyle as StudentProfile["cognitive_style"],
    error_patterns: JSON.parse(row.errorPatterns),
    learning_goal: row.learningGoal as StudentProfile["learning_goal"],
    learning_pace: row.learningPace as StudentProfile["learning_pace"],
    interests: JSON.parse(row.interests),
    updated_at: row.updatedAt.toISOString(),
  };

  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { profile } = (await request.json()) as { profile: StudentProfile };

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      knowledgeLevel: JSON.stringify(profile.knowledge_level),
      cognitiveStyle: profile.cognitive_style,
      errorPatterns: JSON.stringify(profile.error_patterns),
      learningGoal: profile.learning_goal,
      learningPace: profile.learning_pace,
      interests: JSON.stringify(profile.interests),
    },
    update: {
      knowledgeLevel: JSON.stringify(profile.knowledge_level),
      cognitiveStyle: profile.cognitive_style,
      errorPatterns: JSON.stringify(profile.error_patterns),
      learningGoal: profile.learning_goal,
      learningPace: profile.learning_pace,
      interests: JSON.stringify(profile.interests),
    },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `app/api/records/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/backend/auth/prisma";
import { getCurrentUser } from "@/backend/auth/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const records = await prisma.learnRecord.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      topic: r.topic,
      path: JSON.parse(r.path),
      resources: JSON.parse(r.resources),
      progress: JSON.parse(r.progress),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { topic, path, resources, progress } = await request.json();

  const record = await prisma.learnRecord.create({
    data: {
      userId: user.id,
      topic,
      path: JSON.stringify(path),
      resources: JSON.stringify(resources),
      progress: JSON.stringify(progress),
    },
  });

  return NextResponse.json({ id: record.id });
}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: profile + records API routes"
```

---

### Task 5: Middleware + Route Protection

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts` (project root)**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "auth_token";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production",
);

const PROTECTED_PREFIXES = ["/learn", "/profile", "/tutor", "/eval"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/"),
  );
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return redirectToLogin(request, pathname);
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return redirectToLogin(request, pathname);
  }
}

function redirectToLogin(request: NextRequest, from: string) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/learn/:path*",
    "/profile/:path*",
    "/tutor/:path*",
    "/eval/:path*",
  ],
};
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```
- Visit `http://localhost:3000/learn` → should redirect to `/login?from=/learn`
- Visit `http://localhost:3000/` → should NOT redirect

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: middleware route protection for /learn /profile /tutor /eval"
```

---

### Task 6: Login Page + Store User State + UserMenu + Nav Update

**Files:**
- Create: `app/login/page.tsx`
- Create: `frontend/components/auth/UserMenu.tsx`
- Modify: `frontend/lib/store/useLearningStore.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add user state to `useLearningStore.ts`**

In the `LearningStore` interface, after `weakTopics: string[];`, add:

```typescript
  user: { id: string; username: string } | null;
  setUser: (user: { id: string; username: string } | null) => void;
```

In the `create<LearningStore>((set) => ({` block, after `weakTopics: [],`, add:

```typescript
  user: null,
  setUser: (user) => set({ user }),
```

- [ ] **Step 2: Create `frontend/components/auth/UserMenu.tsx`**

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export function UserMenu() {
  const router = useRouter();
  const user = useLearningStore((s) => s.user);
  const setUser = useLearningStore((s) => s.setUser);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
      >
        登录
      </a>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
      >
        <span className="text-base">👤</span>
        <span className="max-w-[80px] truncate">{user.username}</span>
        <span className="text-xs text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <a
            href="/profile"
            className="block px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            我的画像
          </a>
          <button
            type="button"
            onClick={logout}
            className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 hover:bg-rose-50"
          >
            登出
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setUser = useLearningStore((s) => s.setUser);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "register" && password !== confirm) {
      setError("两次密码不一致");
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || "操作失败");
      return;
    }

    setUser(data.user);

    // Load saved profile + records
    try {
      const [profileRes, recordsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/records"),
      ]);
      const profileData = await profileRes.json();
      const recordsData = await recordsRes.json();

      if (profileData.profile) {
        useLearningStore.getState().setProfile(profileData.profile);
      }
      if (recordsData.records?.length > 0) {
        const latest = recordsData.records[0];
        if (latest.path) useLearningStore.getState().setPath(latest.path);
        if (latest.progress)
          useLearningStore.setState({ progress: latest.progress });
        if (latest.resources) {
          const cards: Record<string, typeof latest.resources[0]> = {};
          const order: string[] = [];
          for (const r of latest.resources) {
            cards[r.id] = { ...r, done: true };
            order.push(r.id);
          }
          useLearningStore.setState({
            resourceCards: cards,
            resourceOrder: order,
          });
        }
      }
    } catch {
      // Profile/record loading is best-effort
    }

    const from = searchParams.get("from") || "/";
    router.push(from);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-2xl">
            🎓
          </div>
          <h1 className="text-xl font-bold text-slate-800">智学多智能体</h1>
          <p className="text-sm text-slate-400">个性化学习系统</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex gap-2 border-b border-slate-100">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                }}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  mode === m
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {m === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 6 位）"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            {mode === "register" && (
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="确认密码"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            )}

            {error && (
              <p className="text-center text-xs text-rose-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading
                ? "请稍候…"
                : mode === "login"
                  ? "登 录"
                  : "注 册"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `app/layout.tsx`**

Replace the entire file with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { NavShell } from "@/frontend/components/auth/NavShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "智学多智能体 · 个性化学习系统",
  description:
    "基于大模型的个性化资源生成与学习多智能体系统（第十五届中国软件杯 A3 赛题）",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <NavShell>{children}</NavShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Create `frontend/components/auth/NavShell.tsx`**

This client wrapper syncs auth state on mount and conditionally shows the nav bar:

```tsx
"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { UserMenu } from "./UserMenu";

const NAV_LINKS = [
  { href: "/", label: "对话" },
  { href: "/profile", label: "画像" },
  { href: "/learn", label: "学习中心" },
  { href: "/tutor", label: "辅导" },
  { href: "/eval", label: "评估" },
];

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setUser = useLearningStore((s) => s.setUser);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, [setUser]);

  // Full-screen pages without nav bar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="inline-block h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600" />
            <span>智学多智能体</span>
            <span className="hidden text-xs font-normal text-slate-400 sm:inline">
              A3 · 数据结构与算法
            </span>
          </Link>
          <div className="flex items-center gap-1 text-sm">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    active
                      ? "bg-blue-50 font-medium text-blue-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="ml-2 border-l border-slate-200 pl-2">
              <UserMenu />
            </div>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        多智能体协同框架：LangGraph.js · 大模型：科大讯飞星火 · 架构参考
        THU-MAIC/OpenMAIC (MIT)
      </footer>
    </>
  );
}
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 7: Manual test**

```bash
npm run dev
```
- Visit `/login` → should show login/register form
- Register a user → should redirect to `/`
- Nav bar should show username + dropdown
- Click 登出 → should redirect to `/login`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: login/register page + user state + nav bar with auth"
```

---

## Phase 2: Resource Detail Pages

### Task 7: ResourceDetailLayout + Detail Route

**Files:**
- Create: `frontend/components/resource/detail/ResourceDetailLayout.tsx`
- Create: `app/learn/[resourceId]/page.tsx`

- [ ] **Step 1: Create `frontend/components/resource/detail/ResourceDetailLayout.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MasterySlider } from "@/frontend/components/resource/MasterySlider";
import type { FactCheckResult, ResourceType } from "@/backend/types";

const META: Record<ResourceType, { label: string; badge: string; icon: string }> = {
  doc: { label: "讲解文档", badge: "bg-blue-50 text-blue-700", icon: "📄" },
  quiz: { label: "练习题库", badge: "bg-rose-50 text-rose-700", icon: "❓" },
  mindmap: { label: "思维导图", badge: "bg-amber-50 text-amber-700", icon: "🧠" },
  video: { label: "教学视频", badge: "bg-violet-50 text-violet-700", icon: "🎬" },
  code: { label: "代码实操", badge: "bg-emerald-50 text-emerald-700", icon: "💻" },
  reading: { label: "拓展阅读", badge: "bg-cyan-50 text-cyan-700", icon: "📚" },
};

export function ResourceDetailLayout({
  resType,
  title,
  topic,
  sources,
  factCheck,
  children,
}: {
  resType: ResourceType;
  title: string;
  topic: string;
  sources: string[];
  factCheck?: FactCheckResult;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const meta = META[resType];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          ← 返回
        </button>
        <span className="text-lg">{meta.icon}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badge}`}>
          {meta.label}
        </span>
        <h1 className="flex-1 truncate text-lg font-bold text-slate-800">
          {title}
        </h1>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">
          {topic}
        </span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <MasterySlider topic={topic} />
        {sources.length > 0 && (
          <span className="text-xs text-slate-400">
            引用：{sources.join("、")}
          </span>
        )}
      </div>

      {factCheck && <FactCheckView fc={factCheck} />}
    </div>
  );
}

function FactCheckView({ fc }: { fc: FactCheckResult }) {
  const [open, setOpen] = useState(false);
  const ok = fc.score >= 80;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-xs shadow-sm">
      <button
        type="button"
        onClick={() => fc.flagged.length && setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5"
      >
        <span className={ok ? "text-emerald-600" : "text-amber-600"}>
          🔍 事实核查：{fc.score}%
        </span>
        <span className="text-slate-400">
          （{fc.checked > 0 ? `已核 ${fc.checked} 条` : "无可核声明"}
          {fc.flagged.length > 0 ? `，${fc.flagged.length} 条待核` : ""}）
        </span>
      </button>
      {open && fc.flagged.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-4 text-slate-500">
          {fc.flagged.map((f, i) => (
            <li key={i} className="list-disc">
              未在知识库找到佐证：{f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/learn/[resourceId]/page.tsx`**

```tsx
"use client";

import { use } from "react";
import Link from "next/link";
import { useLearningStore } from "@/frontend/lib/store/useLearningStore";
import { ResourceDetailLayout } from "@/frontend/components/resource/detail/ResourceDetailLayout";
import { DocDetail } from "@/frontend/components/resource/detail/DocDetail";
import { QuizDetail } from "@/frontend/components/resource/detail/QuizDetail";
import { MindmapDetail } from "@/frontend/components/resource/detail/MindmapDetail";
import { VideoDetail } from "@/frontend/components/resource/detail/VideoDetail";
import { CodeDetail } from "@/frontend/components/resource/detail/CodeDetail";
import { ReadingDetail } from "@/frontend/components/resource/detail/ReadingDetail";
import type { ResourceCardState } from "@/backend/types";

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = use(params);
  const card = useLearningStore((s) => s.resourceCards[resourceId]);

  if (!card) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
        资源未加载。可能需要先发起一次对话生成资源。
        <Link href="/" className="ml-2 text-blue-600 underline">
          去对话
        </Link>
      </div>
    );
  }

  return (
    <ResourceDetailLayout
      resType={card.resType}
      title={card.title}
      topic={card.topic}
      sources={card.sources}
      factCheck={card.fact_check}
    >
      <DetailContent card={card} />
    </ResourceDetailLayout>
  );
}

function DetailContent({ card }: { card: ResourceCardState }) {
  if (!card.content) {
    return <p className="text-sm text-slate-400">等待智能体产出…</p>;
  }

  switch (card.resType) {
    case "doc":
      return <DocDetail content={card.content} />;
    case "quiz":
      return <QuizDetail content={card.content} />;
    case "mindmap":
      return <MindmapDetail content={card.content} />;
    case "video":
      return <VideoDetail content={card.content} />;
    case "code":
      return <CodeDetail content={card.content} />;
    case "reading":
      return <ReadingDetail content={card.content} />;
    default:
      return <DocDetail content={card.content} />;
  }
}
```

- [ ] **Step 3: Verify (will fail — detail components don't exist yet)**

```bash
npx tsc --noEmit
```
Expected: errors about missing detail components. This is expected — they're created in Tasks 8-12.

- [ ] **Step 4: Commit (deferred until all detail components exist)**

---

### Task 8: DocDetail + ReadingDetail + VideoDetail

**Files:**
- Create: `frontend/components/resource/detail/DocDetail.tsx`
- Create: `frontend/components/resource/detail/ReadingDetail.tsx`
- Create: `frontend/components/resource/detail/VideoDetail.tsx`

- [ ] **Step 1: Create `DocDetail.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TocItem {
  level: number;
  text: string;
  id: string;
}

export function DocDetail({ content }: { content: string }) {
  const [progress, setProgress] = useState(0);

  const toc = useMemo<TocItem[]>(() => {
    const lines = content.split("\n");
    const items: TocItem[] = [];
    for (const line of lines) {
      const m = line.match(/^(#{2,3})\s+(.+)/);
      if (m) {
        const level = m[1].length;
        const text = m[2].replace(/[`*]/g, "").trim();
        const id = text.replace(/\s+/g, "-");
        items.push({ level, text, id });
      }
    }
    return items;
  }, [content]);

  function onScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? Math.round((el.scrollTop / max) * 100) : 100);
  }

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      {toc.length > 1 && (
        <aside className="sticky top-0 hidden self-start md:block">
          <p className="mb-2 text-xs font-medium text-slate-400">目录</p>
          <ul className="space-y-1 border-l border-slate-200 pl-3">
            {toc.map((item) => (
              <li
                key={item.id}
                className={item.level === 3 ? "ml-3" : ""}
              >
                <a
                  href={`#${item.id}`}
                  className="text-xs text-slate-500 transition hover:text-blue-600"
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400">阅读进度 {progress}%</p>
          </div>
        </aside>
      )}

      <div
        onScroll={onScroll}
        className="doc-view max-h-[70vh] overflow-y-auto pr-2"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => {
              const id = String(children).replace(/\s+/g, "-");
              return <h2 id={id}>{children}</h2>;
            },
            h3: ({ children }) => {
              const id = String(children).replace(/\s+/g, "-");
              return <h3 id={id}>{children}</h3>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ReadingDetail.tsx`**

```tsx
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReadingItem {
  title: string;
  description: string;
  link?: string;
}

function parseReadingItems(content: string): ReadingItem[] {
  const items: ReadingItem[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const m = line.match(/^\d+\.\s*(.+)/);
    if (m) {
      const text = m[1];
      const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        items.push({
          title: linkMatch[1],
          description: text.replace(/\[([^\]]+)\]\(([^)]+)\)/, "").replace(/^[\s\-—:：]+/, ""),
          link: linkMatch[2],
        });
      } else {
        items.push({ title: text, description: "" });
      }
    }
  }
  if (items.length === 0) {
    // Fallback: bullet list items
    for (const line of lines) {
      const m = line.match(/^[-*]\s+(.+)/);
      if (m) items.push({ title: m[1], description: "" });
    }
  }
  return items;
}

export function ReadingDetail({ content }: { content: string }) {
  const items = parseReadingItems(content);
  const [readSet, setReadSet] = useState<Set<number>>(new Set());

  function toggleRead(i: number) {
    setReadSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  if (items.length === 0) {
    return (
      <div className="doc-view">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-xl border p-4 transition ${
            readSet.has(i)
              ? "border-emerald-200 bg-emerald-50/50"
              : "border-slate-200 bg-white"
          }`}
        >
          <button
            type="button"
            onClick={() => toggleRead(i)}
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs transition ${
              readSet.has(i)
                ? "border-emerald-500 bg-emerald-500 text-white"
                : "border-slate-300 hover:border-emerald-400"
            }`}
          >
            {readSet.has(i) ? "✓" : ""}
          </button>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800">{item.title}</h3>
            {item.description && (
              <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-blue-600 hover:underline"
              >
                阅读原文 ↗
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `VideoDetail.tsx`**

```tsx
"use client";

import { VideoPlayer } from "@/frontend/components/resource/VideoPlayer";

export function VideoDetail({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-2xl">
      <VideoPlayer content={content} />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```
Still errors for QuizDetail, MindmapDetail, CodeDetail (created in Tasks 9-11). The 3 created here should compile.

- [ ] **Step 5: Commit (after Tasks 9-12 complete)**

---

### Task 9: CodeDetail (Syntax Highlighting)

**Files:**
- Create: `frontend/components/resource/detail/CodeDetail.tsx`

- [ ] **Step 1: Create `CodeDetail.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CodeBlock {
  language: string;
  code: string;
}

function extractCodeBlocks(content: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(\w+)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    blocks.push({
      language: m[1] || "text",
      code: m[2].trim(),
    });
  }
  return blocks;
}

/** Split content into text segments and code blocks */
function parseContent(content: string) {
  const codeBlocks = extractCodeBlocks(content);
  if (codeBlocks.length === 0) {
    return { text: content, codeBlocks: [] };
  }
  // Remove code blocks from text, keep the surrounding markdown
  const text = content.replace(/```(\w+)?\s*\n[\s\S]*?```/g, "").trim();
  return { text, codeBlocks };
}

export function CodeDetail({ content }: { content: string }) {
  const { text, codeBlocks } = parseContent(content);

  return (
    <div className="space-y-4">
      {text && (
        <div className="doc-view">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}

      {codeBlocks.map((block, i) => (
        <CodeBlockView key={i} block={block} />
      ))}
    </div>
  );
}

function CodeBlockView({ block }: { block: CodeBlock }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700 bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-slate-600 px-4 py-2">
        <span className="text-xs font-medium text-slate-300">
          {block.language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded bg-slate-600 px-2 py-1 text-xs text-slate-200 transition hover:bg-slate-500"
        >
          {copied ? "✓ 已复制" : "📋 复制"}
        </button>
      </div>
      <SyntaxHighlighter
        language={block.language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "13px",
          background: "transparent",
        }}
      >
        {block.code}
      </SyntaxHighlighter>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Still errors for QuizDetail, MindmapDetail. CodeDetail should compile.

---

### Task 10: QuizDetail (Interactive Quiz)

**Files:**
- Create: `frontend/components/resource/detail/QuizDetail.tsx`

- [ ] **Step 1: Create `QuizDetail.tsx`**

```tsx
"use client";

import { useState } from "react";

interface QuizQuestion {
  prompt: string;
  options: string[];
  answerIndex: number; // -1 if not multiple choice
  answerText: string;
  explanation: string;
}

function parseQuiz(content: string): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  // Split by ### 第X题 or ### 题X or ### Q
  const blocks = content.split(/^###\s+/m).filter((b) => b.includes("题") || b.includes("Q"));
  
  for (const block of blocks) {
    const lines = block.split("\n");
    const promptLines: string[] = [];
    const options: string[] = [];
    let answerIndex = -1;
    let answerText = "";
    let explanation = "";
    let inExplanation = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Option: A. B. C. D. or A) B) etc
      const optMatch = trimmed.match(/^([A-D])[.、)]\s*(.+)/);
      if (optMatch) {
        const idx = "ABCD".indexOf(optMatch[1]);
        options[idx] = optMatch[2];
        continue;
      }

      // Answer line
      const ansMatch = trimmed.match(/\*?\*?答案\*?\*?[：:]\s*([A-D]+)/);
      if (ansMatch) {
        answerIndex = "ABCD".indexOf(ansMatch[1][0]);
        continue;
      }

      const ansTextMatch = trimmed.match(/\*?\*?答案\*?\*?[：:]\s*(.+)/);
      if (ansTextMatch && answerIndex === -1) {
        answerText = ansTextMatch[1];
        continue;
      }

      // Explanation
      const expMatch = trimmed.match(/\*?\*?解析\*?\*?[：:]\s*(.*)/);
      if (expMatch) {
        explanation = expMatch[1];
        inExplanation = true;
        continue;
      }

      if (inExplanation) {
        explanation += " " + trimmed;
      } else if (options.length === 0 && !trimmed.startsWith("**答案") && !trimmed.startsWith("**解析")) {
        promptLines.push(trimmed);
      }
    }

    if (promptLines.length > 0 || options.length > 0) {
      questions.push({
        prompt: promptLines.join(" ").replace(/^第\d+题\s*/, "").replace(/^题\d+\s*/, ""),
        options: options.filter(Boolean),
        answerIndex,
        answerText,
        explanation,
      });
    }
  }

  // Fallback: if no structured questions parsed, show raw content
  return questions;
}

export function QuizDetail({ content }: { content: string }) {
  const questions = parseQuiz(content);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  if (questions.length === 0) {
    return (
      <div className="doc-view">
        <pre className="whitespace-pre-wrap text-sm">{content}</pre>
      </div>
    );
  }

  const score = questions.filter(
    (q, i) => q.answerIndex >= 0 && answers[i] === q.answerIndex,
  ).length;
  const total = questions.filter((q) => q.answerIndex >= 0).length;

  return (
    <div className="space-y-4">
      {submitted && total > 0 && (
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
          <span className="text-lg font-bold text-blue-700">
            得分：{score}/{total}
          </span>
          <span className="ml-2 text-sm text-slate-500">
            （{Math.round((score / total) * 100)} 分）
          </span>
        </div>
      )}

      {questions.map((q, qi) => {
        const userAnswer = answers[qi];
        const isCorrect = submitted && q.answerIndex >= 0 && userAnswer === q.answerIndex;
        const isWrong = submitted && q.answerIndex >= 0 && userAnswer !== undefined && userAnswer !== q.answerIndex;

        return (
          <div
            key={qi}
            className={`rounded-xl border p-4 ${
              isCorrect
                ? "border-emerald-200 bg-emerald-50/30"
                : isWrong
                  ? "border-rose-200 bg-rose-50/30"
                  : "border-slate-200"
            }`}
          >
            <p className="mb-3 text-sm font-medium text-slate-800">
              第 {qi + 1} 题
            </p>
            <p className="mb-3 text-sm text-slate-700">{q.prompt}</p>

            {q.options.length > 0 ? (
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = userAnswer === oi;
                  const showCorrect = submitted && oi === q.answerIndex;
                  const showWrong = submitted && selected && oi !== q.answerIndex;

                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((a) => ({ ...a, [qi]: oi }))}
                      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        showCorrect
                          ? "border-emerald-400 bg-emerald-50 text-emerald-800"
                          : showWrong
                            ? "border-rose-400 bg-rose-50 text-rose-800"
                            : selected
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-mono font-bold">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      <span>{opt}</span>
                      {showCorrect && <span className="ml-auto">✓</span>}
                      {showWrong && <span className="ml-auto">✕</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <p className="font-medium">参考答案：</p>
                <p className="mt-1">{q.answerText || "（见解析）"}</p>
              </div>
            )}

            {submitted && q.explanation && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="font-medium">💡 解析：</span>
                {q.explanation}
              </div>
            )}
          </div>
        );
      })}

      {!submitted && total > 0 && (
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          提交答案
        </button>
      )}

      {submitted && (
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setSubmitted(false);
          }}
          className="w-full rounded-xl border border-slate-300 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          重新作答
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```
Still errors for MindmapDetail. QuizDetail should compile.

---

### Task 11: MindmapDetail (Tree Visualization)

**Files:**
- Create: `frontend/components/resource/detail/MindmapDetail.tsx`

- [ ] **Step 1: Create `MindmapDetail.tsx`**

```tsx
"use client";

import { useState } from "react";

interface TreeNode {
  text: string;
  children: TreeNode[];
}

function parseMindmap(content: string): TreeNode | null {
  const lines = content.split("\n").filter((l) => {
    const trimmed = l.trim();
    return trimmed.startsWith("-") || trimmed.startsWith("#");
  });

  if (lines.length === 0) return null;

  // Find root: first # heading or first top-level - item
  let rootText = "主题";
  let rootLineIdx = 0;
  const h1Match = content.match(/^#\s+(.+)/m);
  if (h1Match) {
    rootText = h1Match[1].trim();
  }

  // Parse bullet list into tree based on indentation
  const bulletLines: { indent: number; text: string }[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("#")) continue;
    const indent = line.search(/\S/);
    const text = line.trim().replace(/^[-*]\s+/, "");
    bulletLines.push({ indent, text });
  }

  if (bulletLines.length === 0) {
    return { text: rootText, children: [] };
  }

  // Normalize indents (find minimum indent as level 0)
  const minIndent = Math.min(...bulletLines.map((l) => l.indent));
  const normalized = bulletLines.map((l) => ({
    ...l,
    level: Math.round((l.indent - minIndent) / 2),
  }));

  // Build tree
  const root: TreeNode = { text: rootText, children: [] };
  const stack: TreeNode[] = [root];

  for (const item of normalized) {
    const node: TreeNode = { text: item.text, children: [] };
    // Pop stack to correct level
    while (stack.length > item.level + 1) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  return root;
}

export function MindmapDetail({ content }: { content: string }) {
  const tree = parseMindmap(content);

  if (!tree) {
    return (
      <div className="doc-view">
        <pre className="whitespace-pre-wrap text-sm">{content}</pre>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <TreeView node={tree} isRoot />
    </div>
  );
}

function TreeView({ node, isRoot }: { node: TreeNode; isRoot?: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className={isRoot ? "" : "ml-4"}>
      <div className="flex items-center gap-1.5 py-1">
        {hasChildren && (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex h-4 w-4 items-center justify-center text-xs text-slate-400 hover:text-slate-600"
          >
            {collapsed ? "▶" : "▼"}
          </button>
        )}
        <span
          className={`rounded px-2 py-0.5 text-sm ${
            isRoot
              ? "bg-blue-600 font-bold text-white"
              : hasChildren
                ? "bg-blue-50 font-medium text-blue-700"
                : "bg-slate-50 text-slate-600"
          }`}
        >
          {node.text}
        </span>
      </div>
      {hasChildren && !collapsed && (
        <div className="ml-3 border-l border-slate-200 pl-3">
          {node.children.map((child, i) => (
            <TreeView key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm run lint
```
Expected: no errors (all 6 detail components now exist).

- [ ] **Step 3: Commit (Tasks 7-11 together)**

```bash
git add -A
git commit -m "feat: resource detail pages with 6 specialized renderers"
```

---

### Task 12: Overview Page Improvements (Clickable Cards)

**Files:**
- Modify: `app/learn/page.tsx`
- Modify: `frontend/components/resource/ResourceCard.tsx`

- [ ] **Step 1: Make ResourceCard clickable**

In `frontend/components/resource/ResourceCard.tsx`, wrap the `<section>` in a `<Link>`. Replace the `<section>` opening tag and closing `</section>`:

Replace lines 59-60:
```tsx
  return (
    <section
```
With:
```tsx
  const cardHref = `/learn/${card.id}`;

  return (
    <Link
      href={cardHref}
```

Replace the closing `</section>` (line 114) with `</Link>`.

Add the import at the top of the file:
```tsx
import Link from "next/link";
```

Also add hover styles to the section/link element — add `transition hover:border-blue-300 hover:shadow-md cursor-pointer` to the className.

The content area should show a preview (truncated), not the full content. Replace the content area (lines 86-96):
```tsx
      <div className="flex-1">
        {card.content ? (
          <div className="line-clamp-4 text-sm text-slate-500">
            {card.content.slice(0, 200)}…
          </div>
        ) : (
          <p className="text-sm text-slate-400">等待智能体产出…</p>
        )}
      </div>
```

Remove the `DocView` and `VideoPlayer` imports since they're no longer used in the card.

Simplify the footer — keep only mastery slider and status, move fact_check to detail page only:
```tsx
      {card.done && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <MasterySlider topic={card.topic} />
          <span className="text-xs font-medium text-blue-600">
            查看详情 →
          </span>
        </div>
      )}
```

Remove the FactCheckView component and its usage from ResourceCard (it's now in ResourceDetailLayout).

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Manual test**

```bash
npm run dev
```
- Generate resources via chat → cards on `/learn` should be clickable
- Click a card → should navigate to `/learn/[resourceId]` with the specialized renderer

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: clickable resource cards + preview on overview page"
```

---

## Phase 3: Persistence Integration

### Task 13: Store Persistence Actions + Auto-Sync Wiring

**Files:**
- Modify: `frontend/lib/store/useLearningStore.ts`
- Modify: `frontend/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Add persistence actions to store**

In `useLearningStore.ts`, add to the interface after `setUser`:

```typescript
  /** Persist current profile to server (debounced) */
  syncProfile: () => void;
  /** Save current learning session as a record */
  saveRecord: () => Promise<void>;
```

Add a debounce ref at module scope (after the imports):

```typescript
let profileSyncTimer: ReturnType<typeof setTimeout> | null = null;
```

Add implementations in the store body (after `setUser: (user) => set({ user }),`):

```typescript
  syncProfile: () => {
    if (profileSyncTimer) clearTimeout(profileSyncTimer);
    profileSyncTimer = setTimeout(async () => {
      const state = useLearningStore.getState();
      if (!state.user || !state.profile) return;
      try {
        await fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile: state.profile }),
        });
      } catch {
        // best-effort
      }
    }, 3000);
  },

  saveRecord: async () => {
    const state = useLearningStore.getState();
    if (!state.user) return;
    const cards = state.resourceOrder
      .map((id) => state.resourceCards[id])
      .filter(Boolean);
    if (cards.length === 0 || !state.path) return;
    const topic = state.path.steps[0]?.title || "学习记录";
    try {
      await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          path: state.path,
          resources: cards,
          progress: state.progress,
        }),
      });
    } catch {
      // best-effort
    }
  },
```

Also update `setProfile` to trigger sync:

Replace:
```typescript
  setProfile: (p) => set({ profile: p }),
```
With:
```typescript
  setProfile: (p) => {
    set({ profile: p });
    if (useLearningStore.getState().user) {
      useLearningStore.getState().syncProfile();
    }
  },
```

- [ ] **Step 2: Wire `saveRecord` on SSE done in ChatPanel**

In `frontend/components/chat/ChatPanel.tsx`, in the `handleEvent` function, update the `"done"` case:

Replace:
```typescript
      case "done":
        setTurns((t) =>
          t.map((turn) => (turn.id === assistantId ? { ...turn, done: true } : turn)),
        );
        break;
```

With:
```typescript
      case "done":
        setTurns((t) =>
          t.map((turn) => (turn.id === assistantId ? { ...turn, done: true } : turn)),
        );
        useLearningStore.getState().saveRecord();
        break;
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 4: Manual test**

```bash
npm run dev
```
- Login → send a chat message → wait for resources
- After done event, check that `prisma/dev.db` has a LearnRecord (or check network tab for POST /api/records)
- Refresh page → should still be logged in
- Navigate to `/learn` → resources should still be in store (loaded from login)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: profile + learning record persistence with auto-sync"
```

---

### Task 14: Docker + Build Config

**Files:**
- Modify: `next.config.ts`
- Modify: `Dockerfile`

- [ ] **Step 1: Update `next.config.ts`**

Add prisma files to `outputFileTracingIncludes`:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.192.1"],
  outputFileTracingIncludes: {
    "/api/learn": ["./backend/knowledge_base/**/*"],
    "/api/tutor": ["./backend/knowledge_base/**/*"],
    "/api/profile": ["./prisma/**/*"],
    "/api/records": ["./prisma/**/*"],
    "/api/auth/**": ["./prisma/**/*"],
  },
};
```

- [ ] **Step 2: Update `Dockerfile`**

Add `npx prisma generate` before the build step. Find the line that runs `npm run build` and add before it:

```dockerfile
RUN npx prisma generate
```

Also add the prisma directory copy. After the `COPY --from=deps ...` line, add:

```dockerfile
COPY prisma ./prisma
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: build succeeds. Check that `.next/standalone` includes prisma files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Docker + standalone build support for Prisma"
```

---

## Verification Checklist (Final)

After all tasks complete, run through this checklist:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — build succeeds
- [ ] Register a new user at `/login`
- [ ] Login redirects to `/`
- [ ] Send a chat message → resources generate
- [ ] Click a resource card → detail page shows with specialized renderer
- [ ] Quiz: answer questions → submit → see score
- [ ] Mindmap: tree renders with collapse/expand
- [ ] Code: syntax highlighted with copy button
- [ Doc: TOC sidebar + reading progress
- [ ] Video: SVG animation player works
- [ ] Reading: link cards with read tracking
- [ ] Refresh page → still logged in
- [ ] Logout → redirect to `/login`
- [ ] Protected routes redirect to `/login` when logged out
