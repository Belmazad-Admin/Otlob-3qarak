import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone (only the files it needs) for the Docker image on Azure Container
  // Apps. Only the Dockerfile turns it on (NEXT_OUTPUT=standalone): on Windows it needs symlink rights most PCs
  // don't have, and Vercel doesn't need it.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
};

export default nextConfig;
