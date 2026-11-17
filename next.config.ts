import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep browser-test artifacts separate from an active local dev server.
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
};

export default nextConfig;
