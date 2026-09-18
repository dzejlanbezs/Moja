import { fail, json } from "@/lib/api";
import { getSessionUser, startGuestSession, toSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PaygateError, createPaygatePayment, newPaymentToken, providerIdFor } from "@/lib/paygate";
import { notifyChatUnlocked } from "@/lib/pushover";
import { OrderError, createOrder } from "@/lib/queries";
import type { ModelRow } from "@/lib/types";

export async function POST(request: Request) {
  let user = await getSessionUser();
  if (user && user.role !== "user") return fail("Only member accounts can unlock chats", 403);

  const body = (await request.json().catch(() => null)) as
    | { slug?: string; method?: "card" | "paypal" | "cashapp" | "balance" }
    | null;

  if (!body?.slug) return fail("Missing profile");
  const model = db.prepare("SELECT * FROM models WHERE slug = ?").get(body.slug) as ModelRow | undefined;
  if (!model) return fail("Profile not found", 404);

  const isFree = model.price_cents === 0;
  if (!user && !isFree) return fail("Please sign in first", 401);
  if (user?.isGuest && !isFree) {
    return fail("Create a free account to unlock paid profiles", 403);
  }

  // A visitor who opens a free chat gets a guest account so the conversation survives in their cookie.
  if (!user) {
    user = toSessionUser(await startGuestSession());
  }

  const requested =
    body.method === "balance"
      ? "balance"
      : body.method === "paypal"
        ? "paypal"
        : body.method === "cashapp"
          ? "cashapp"
          : "card";

  try {
    // Free profile: no payment at all, the chat opens immediately.
    if (isFree || requested === "balance") {
      const order = createOrder({ userId: user.id, modelId: model.id, method: isFree ? "card" : "balance" });

      notifyChatUnlocked({
        modelName: model.name,
        memberName: user.displayName,
        amountCents: model.price_cents,
        method: isFree ? "free" : "balance",
        code: order.code,
        free: order.free,
      });

      return json(
        {
          ok: true,
          code: order.code,
          method: isFree ? "free" : "balance",
          free: order.free,
          conversationId: order.conversationId,
          amountCents: model.price_cents,
          modelName: model.name,
        },
        201,
      );
    }

    // Card or PayPal: create the order, then send the customer to the hosted checkout.
    const payToken = newPaymentToken();
    const providerId = providerIdFor(requested);
    const order = createOrder({
      userId: user.id,
      modelId: model.id,
      method: "card",
      provider: providerId,
      payToken,
    });

    const payment = await createPaygatePayment({
      ref: order.code,
      token: payToken,
      amountCents: model.price_cents,
      method: requested,
    });

    notifyChatUnlocked({
      modelName: model.name,
      memberName: user.displayName,
      amountCents: model.price_cents,
      method: `${providerId} (started)`,
      code: order.code,
      free: false,
    });

    return json(
      {
        ok: true,
        code: order.code,
        method: requested,
        free: false,
        conversationId: null,
        amountCents: model.price_cents,
        modelName: model.name,
        redirectUrl: payment.payUrl,
      },
      201,
    );
  } catch (error) {
    if (error instanceof PaygateError) return fail(error.message, 502);
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
