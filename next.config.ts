import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 产出独立运行包（.next/standalone），供 Docker 镜像直接 `node server.js` 运行
  output: "standalone",
  // 允许局域网 IP 访问 dev server（消除跨域警告）
  allowedDevOrigins: ["192.168.192.1"],
  // 确保知识库 markdown 被 standalone 构建追踪（retriever 按 fs 路径读取）
  outputFileTracingIncludes: {
    "/api/learn": ["./backend/knowledge_base/**/*"],
    "/api/tutor": ["./backend/knowledge_base/**/*"],
  },
};

export default nextConfig;
