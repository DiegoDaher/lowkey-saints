import type { NextConfig } from "next";
/** @type {import('next').NextConfig} */

const nextConfig: NextConfig = {
  experimental: { authInterrupts: true },
  // Keep browser-test artifacts separate from an active local dev server.
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
  async rewrites() {
    return [
      {
        source: "/140210",
        destination: "/admin",
      },
      {
        // Esto cubre todas las subrutas (ej. /140210/usuarios -> /admin/usuarios)
        source: "/140210/:path*",
        destination: "/admin/:path*",
      },
    ];
  },
};

export default nextConfig;
