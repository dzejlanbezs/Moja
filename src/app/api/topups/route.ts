import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { findCryptoAsset } from "@/lib/crypto-wallets";
import { PaygateError, createPaygatePayment, newPaymentToken, providerIdFor } from "@/lib/paygate";
import { notifyTopup } from "@/lib/pushover";
import { MIN_TOPUP_CENTS, OrderError, createTopup } from "@/lib/queries";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in first", 401);
  if (user.role !== "user") return fail("Only member accounts have a balance", 403);
  if (user.isGuest) return fail("Create a free account to use a balance", 403);

  const body = (await request.json().catch(() => null)) as
    | { amountCents?: number; method?: "card" | "paypal" | "cashapp" | "crypto"; asset?: string }
    | null;

  const amount = Math.round(Number(body?.amountCents ?? 0));
  if (!Number.isFinite(amount) || amount <= 0) return fail("Enter how much you want to add");
  if (amount < MIN_TOPUP_CENTS) return fail(`The minimum top-up is $${MIN_TOPUP_CENTS / 100}`);

  const method =
    body?.method === "crypto"
      ? "crypto"
      : body?.method === "paypal"
        ? "paypal"
        : body?.method === "cashapp"
          ? "cashapp"
          : "card";

  try {
    // Crypto: the member sends it themselves to our wallet.
    if (method === "crypto") {
      const asset = findCryptoAsset(body?.asset);
      if (!asset) return fail("Pick a coin to pay with");

      const topup = createTopup({
        userId: user.id,
        amountCents: amount,
        method: "crypto",
        crypto: { assetId: asset.id, address: asset.address },
      });

      notifyTopup({
        memberName: user.displayName,
        amountCents: amount,
        creditCents: topup.creditCents,
        code: topup.code,
        source: asset.symbol,
      });

      return json(
        { ok: true, code: topup.code, method, amountCents: amount, feeCents: topup.feeCents, creditCents: topup.creditCents },
        201,
      );
    }

    // Card or PayPal: hand the customer over to the hosted checkout.
    const payToken = newPaymentToken();
    const providerId = providerIdFor(method);
    const topup = createTopup({
      userId: user.id,
      amountCents: amount,
      method: "card",
      provider: providerId,
      payToken,
    });

    const payment = await createPaygatePayment({
      ref: topup.code,
      token: payToken,
      amountCents: amount,
      method,
    });

    notifyTopup({
      memberName: user.displayName,
      amountCents: amount,
      creditCents: topup.creditCents,
      code: topup.code,
      source: `${providerId} (started)`,
    });

    return json(
      { ok: true, code: topup.code, method, amountCents: amount, redirectUrl: payment.payUrl },
      201,
    );
  } catch (error) {
    if (error instanceof PaygateError) return fail(error.message, 502);
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
