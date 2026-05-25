import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/smart-media-toolkit",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
