import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 产出独立运行包（.next/standalone），供 Docker 镜像直接 `node server.js` 运行
  output: "standalone",
  // 允许局域网 IP 访问 dev server（消除跨域警告）
  allowedDevOrigins: ["192.168.192.1", "172.28.64.1"],
  outputFileTracingIncludes: {
    "/api/profile": ["./prisma/**/*"],
    "/api/records": ["./prisma/**/*"],
    "/api/auth/register": ["./prisma/**/*"],
    "/api/auth/login": ["./prisma/**/*"],
    "/api/auth/me": ["./prisma/**/*"],
  },
};

export default nextConfig;
