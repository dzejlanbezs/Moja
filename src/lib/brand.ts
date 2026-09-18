import "server-only";

import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const EXTENSIONS = [".png", ".svg", ".webp", ".jpg", ".jpeg", ".ico"];

export const PROVIDER_KEYS = ["card", "paypal", "cashapp", "crypto"] as const;
export type ProviderKey = (typeof PROVIDER_KEYS)[number];

function findFile(folder: string, base: string) {
  for (const extension of EXTENSIONS) {
    const filePath = path.join(PUBLIC_DIR, folder, base + extension);
    try {
      const stat = fs.statSync(filePath);
      return { path: filePath, extension, version: Math.round(stat.mtimeMs) };
    } catch {
      continue;
    }
  }
  return null;
}

export function brandFile(asset: "logo" | "favicon") {
  return findFile("", asset);
}

/** Payment provider logos live in public/providers/<id>.png — card, paypal, cashapp, crypto. */
export function providerFile(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  return findFile("providers", id);
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

/** URL per payment method, or null when no logo file was dropped in for it. */
export function providerLogos(): Record<ProviderKey, string | null> {
  const entries = PROVIDER_KEYS.map((key) => {
    const file = providerFile(key);
    return [key, file ? `/api/brand/provider/${key}?v=${file.version}` : null] as const;
  });
  return Object.fromEntries(entries) as Record<ProviderKey, string | null>;
}
