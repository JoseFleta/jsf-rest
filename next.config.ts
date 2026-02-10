import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
