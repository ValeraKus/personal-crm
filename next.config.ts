import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone: the Docker image runs it without node_modules
  output: "standalone",
};

export default nextConfig;
