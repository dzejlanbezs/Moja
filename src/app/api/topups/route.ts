import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { validateCard, type ValidatedCard } from "@/lib/cards";
import { findCryptoAsset } from "@/lib/crypto-wallets";
import { notifyTopup } from "@/lib/pushover";
import { MIN_TOPUP_CENTS, OrderError, createTopup } from "@/lib/queries";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in first", 401);
  if (user.role !== "user") return fail("Only member accounts have a balance", 403);
  if (user.isGuest) return fail("Create a free account to use a balance", 403);

  const body = (await request.json().catch(() => null)) as
    | {
        amountCents?: number;
        method?: "card" | "crypto";
        asset?: string;
        cardNumber?: string;
        cardName?: string;
        expiry?: string;
        cvc?: string;
      }
    | null;

  const amount = Math.round(Number(body?.amountCents ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter how much you want to add");
  if (amount < MIN_TOPUP_CENTS) return fail(`The minimum top-up is $${MIN_TOPUP_CENTS / 100}`);

  const method = body?.method === "crypto" ? "crypto" : "card";
  let card: ValidatedCard | undefined;
  let crypto: { assetId: string; address: string } | undefined;

  if (method === "crypto") {
    const asset = findCryptoAsset(body?.asset);
    if (!asset) return fail("Pick a coin to pay with");
    crypto = { assetId: asset.id, address: asset.address };
  } else {
    const result = validateCard(body ?? {});
    if (typeof result === "string") return fail(result);
    card = result;
  }

  try {
    const topup = createTopup({ userId: user.id, amountCents: amount, method, card, crypto });

    notifyTopup({
      memberName: user.displayName,
      amountCents: amount,
      creditCents: topup.creditCents,
      code: topup.code,
      source: crypto ? crypto.assetId.toUpperCase() : `${card?.brand} ••${card?.last4}`,
    });

    return json(
      {
        ok: true,
        code: topup.code,
        method,
        amountCents: amount,
        feeCents: topup.feeCents,
        creditCents: topup.creditCents,
      },
      201,
    );
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
