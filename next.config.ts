import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 배포: output: "export" 제거 (서버 기능 활성화)
  images: {
    unoptimized: false, // Vercel Image Optimization 활성화
  },
  turbopack: {},
};

export default nextConfig;
