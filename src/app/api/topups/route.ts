import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { validateCard } from "@/lib/cards";
import { MIN_TOPUP_CENTS, OrderError, createTopup } from "@/lib/queries";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in first", 401);
  if (user.role !== "user") return fail("Only member accounts have a balance", 403);

  const body = (await request.json().catch(() => null)) as
    | { amountCents?: number; cardNumber?: string; cardName?: string; expiry?: string; cvc?: string }
    | null;

  const amount = Math.round(Number(body?.amountCents ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter how much you want to add");
  if (amount < MIN_TOPUP_CENTS) return fail(`The minimum top-up is $${MIN_TOPUP_CENTS / 100}`);

  const card = validateCard(body ?? {});
  if (typeof card === "string") return fail(card);

  try {
    const { code } = createTopup({ userId: user.id, amountCents: amount, card });
    return json({ ok: true, code, amountCents: amount }, 201);
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
