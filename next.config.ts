import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // Hides the floating Next.js dev tools badge in the corner of the site.
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Uploads are streamed through a route handler, keep the body limit generous.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
