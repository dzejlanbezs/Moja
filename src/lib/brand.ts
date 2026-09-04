import "server-only";

import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

const CANDIDATES = {
  logo: ["logo.png", "logo.svg", "logo.webp", "logo.jpg", "logo.jpeg"],
  favicon: ["favicon.png", "favicon.ico", "favicon.svg", "favicon.webp"],
} as const;

export type BrandAsset = keyof typeof CANDIDATES;

export function brandFile(asset: BrandAsset) {
  for (const name of CANDIDATES[asset]) {
    const filePath = path.join(PUBLIC_DIR, name);
    try {
      const stat = fs.statSync(filePath);
      return { path: filePath, extension: path.extname(name), version: Math.round(stat.mtimeMs) };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Branding is file based: drop `logo.png` and `favicon.png` into `public/` and they are picked up
 * on the next request — no rebuild — otherwise the built-in wordmark is used.
 */
export function brandAssets() {
  const logo = brandFile("logo");
  const favicon = brandFile("favicon");
  return {
    logoUrl: logo ? `/api/brand/logo?v=${logo.version}` : null,
    faviconUrl: favicon ? `/api/brand/favicon?v=${favicon.version}` : null,
  };
}
