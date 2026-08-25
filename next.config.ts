import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it external instead of bundling it.
  serverExternalPackages: ["better-sqlite3"],
  // Ship the bundled DVF database with the route that reads it.
  outputFileTracingIncludes: {
    "/api/dvf/comparables": ["./data/dvf-2025.sqlite"],
  },
};

export default nextConfig;
