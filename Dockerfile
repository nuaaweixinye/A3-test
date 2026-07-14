# 多阶段构建：Next.js 16 standalone 输出，最小化运行镜像
# 构建：docker compose build  /  运行：docker compose up

# ===== 1. 依赖层 =====
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ===== 2. 构建层 =====
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY ./prisma ./prisma
COPY . .
# Next 16 默认 Turbopack 构建，output:standalone 产出 .next/standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

# ===== 3. 运行层 =====
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 用户运行
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# 拷贝 standalone 产物（含仅必要的 node_modules）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
