import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 产出独立运行包（.next/standalone），供 Docker 镜像直接 `node server.js` 运行
  output: "standalone",
};

export default nextConfig;
