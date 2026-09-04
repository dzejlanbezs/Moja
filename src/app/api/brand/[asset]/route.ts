import fs from "node:fs/promises";

import { brandFile } from "@/lib/brand";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

/** Serves public/logo.* and public/favicon.* at runtime so replacing them needs no rebuild. */
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  if (asset !== "logo" && asset !== "favicon") return new Response("Not found", { status: 404 });

  const file = brandFile(asset);
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
