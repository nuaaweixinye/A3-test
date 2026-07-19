import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  outputFileTracingIncludes: {
    "/api/profile": ["./prisma/**/*"],
    "/api/records": ["./prisma/**/*"],
    "/api/auth/register": ["./prisma/**/*"],
    "/api/auth/login": ["./prisma/**/*"],
    "/api/auth/me": ["./prisma/**/*"],
    "/api/ppt/render": ["./public/generated-ppts/**/*"],
    "/api/video/render": ["./public/generated-videos/**/*"],
  },
};

export default nextConfig;
