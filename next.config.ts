import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  // Hides the floating Next.js dev tools badge in the corner of the site.
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  // Profile artwork and chat uploads are already resized webp, so re-encoding them
  // per request only burns CPU on the host and makes the first paint slower.
  images: { unoptimized: true },
  experimental: {
    // Uploads are streamed through a route handler, keep the body limit generous.
    serverActions: { bodySizeLimit: "12mb" },
    // Keep rendered pages in the client router for a while, so going back to a page
    // you just visited is instant instead of a fresh round trip.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
