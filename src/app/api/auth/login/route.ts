import { fail, json } from "@/lib/api";
import {
  findUserByEmail,
  getSessionUser,
  homeForRole,
  startSession,
  toSessionUser,
  verifyPassword,
} from "@/lib/auth";
import { mergeGuestInto } from "@/lib/queries";
import type { Role } from "@/lib/types";

const PORTAL_ROLE: Record<string, Role> = {
  member: "user",
  model: "model",
  admin: "admin",
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; password?: string; portal?: string }
    | null;
  if (!body?.email || !body?.password) return fail("Email and password are required");

  const user = findUserByEmail(body.email);
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return fail("Wrong email or password", 401);
  }

  const expected = body.portal ? PORTAL_ROLE[body.portal] : undefined;
  if (expected && user.role !== expected) {
    const label = expected === "admin" ? "an admin" : expected === "model" ? "a talent" : "a member";
    return fail(`This is not ${label} account`, 403);
  }

  // Someone who chatted as a guest keeps those conversations when they sign in.
  const current = await getSessionUser();
  if (current?.isGuest && current.id !== user.id && user.role === "user") {
    mergeGuestInto(current.id, user.id);
  }

  await startSession(user.id);
  return json({ user: toSessionUser(user), redirect: homeForRole(user.role) });
}
