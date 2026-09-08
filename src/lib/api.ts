import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { UPLOAD_DIR } from "@/lib/db";

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** Normalises an uploaded image to webp and returns the URL it is served from. */
export async function saveImageUpload(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Only image files are supported");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Image is larger than 8 MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(UPLOAD_DIR, name));

  return `/api/files/${name}`;
}
