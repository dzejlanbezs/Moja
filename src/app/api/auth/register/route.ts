import { fail, json } from "@/lib/api";
import { findUserByEmail, getSessionUser, hashPassword, startSession, toSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { UserRow } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { name?: string; email?: string; password?: string }
    | null;

  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";

  if (!name || name.length < 2) return fail("Please enter your name");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Please enter a valid email");
  if (password.length < 6) return fail("Password must be at least 6 characters");
  if (findUserByEmail(email)) return fail("An account with this email already exists", 409);

  // A guest who signs up keeps the same row, so the chats they already started stay with them.
  const current = await getSessionUser();
  if (current?.isGuest) {
    db.prepare(
      "UPDATE users SET email = ?, password_hash = ?, display_name = ?, is_guest = 0 WHERE id = ?",
    ).run(email, hashPassword(password), name, current.id);
    const upgraded = db.prepare("SELECT * FROM users WHERE id = ?").get(current.id) as UserRow;
    await startSession(upgraded.id);
    return json({ user: toSessionUser(upgraded), redirect: "/chat" }, 201);
  }

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, role, balance_cents, avatar_url, created_at)
       VALUES (?, ?, ?, 'user', 0, NULL, ?)`,
    )
    .run(email, hashPassword(password), name, Date.now());

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(info.lastInsertRowid)) as UserRow;
  await startSession(user.id);
  return json({ user: toSessionUser(user), redirect: "/" }, 201);
}
