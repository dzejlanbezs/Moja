import { fail, json } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { topUpBalance } from "@/lib/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("admin");
  if (!admin) return fail("Admin access required", 403);

  const { id } = await params;
  const userId = Number(id);
  const body = (await request.json().catch(() => null)) as { amountCents?: number; note?: string } | null;
  const amount = Math.round(Number(body?.amountCents ?? 0));

  if (!Number.isFinite(amount) || amount === 0) return fail("Enter an amount");
  const member = db.prepare("SELECT id, role, balance_cents FROM users WHERE id = ?").get(userId) as
    | { id: number; role: string; balance_cents: number }
    | undefined;
  if (!member || member.role !== "user") return fail("Member not found", 404);
  if (member.balance_cents + amount < 0) return fail("Balance cannot go negative");

  topUpBalance(userId, amount, body?.note?.trim() || (amount > 0 ? "Admin top-up" : "Admin adjustment"));
  const updated = db.prepare("SELECT balance_cents FROM users WHERE id = ?").get(userId) as {
    balance_cents: number;
  };
  return json({ ok: true, balanceCents: updated.balance_cents });
}
