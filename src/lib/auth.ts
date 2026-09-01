import "server-only";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";

import { DATA_DIR, db } from "@/lib/db";
import type { Role, SessionUser, UserRow } from "@/lib/types";

export const SESSION_COOKIE = "aurea_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function secret(): string {
  if (process.env.AUREA_SECRET) return process.env.AUREA_SECRET;
  const secretPath = path.join(DATA_DIR, ".session-secret");
  if (!fs.existsSync(secretPath)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(secretPath, crypto.randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  return fs.readFileSync(secretPath, "utf8").trim();
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encodeToken(userId: number) {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

function decodeToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: number; exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export function hashPassword(plain: string) {
  return bcrypt.hashSync(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compareSync(plain, hash);
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    balanceCents: row.balance_cents,
    avatarUrl: row.avatar_url,
  };
}

export function findUserByEmail(email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email.trim()) as UserRow | undefined;
}

export function findUserById(id: number): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export async function startSession(userId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encodeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const userId = decodeToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const row = findUserById(userId);
  return row ? toSessionUser(row) : null;
}

export async function requireRole(role: Role): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || user.role !== role) return null;
  return user;
}

/** Home route for a role — each portal has its own entry point. */
export function homeForRole(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "model") return "/portal";
  return "/chat";
}
