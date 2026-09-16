import fs from "node:fs/promises";

import { brandFile, providerFile } from "@/lib/brand";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

/**
 * Serves the files you drop into public/ at runtime, so replacing a logo needs no rebuild:
 *   /api/brand/logo, /api/brand/favicon, /api/brand/provider/<card|paypal|cashapp|crypto>
 */
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params;

  const file =
    asset[0] === "provider" && asset[1]
      ? providerFile(asset[1])
      : asset[0] === "logo" || asset[0] === "favicon"
        ? brandFile(asset[0])
        : null;

  if (!file) return new Response("Not found", { status: 404 });

  try {
    const body = await fs.readFile(file.path);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": CONTENT_TYPES[file.extension] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
