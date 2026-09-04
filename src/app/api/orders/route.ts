import { fail, json } from "@/lib/api";
import { getSessionUser, startGuestSession, toSessionUser } from "@/lib/auth";
import { validateCard, type ValidatedCard } from "@/lib/cards";
import { db } from "@/lib/db";
import { OrderError, createOrder } from "@/lib/queries";
import type { ModelRow } from "@/lib/types";

export async function POST(request: Request) {
  let user = await getSessionUser();
  if (user && user.role !== "user") return fail("Only member accounts can unlock chats", 403);

  const body = (await request.json().catch(() => null)) as
    | {
        slug?: string;
        method?: "card" | "balance";
        cardNumber?: string;
        cardName?: string;
        expiry?: string;
        cvc?: string;
      }
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

  const method = body.method === "balance" ? "balance" : "card";
  let card: ValidatedCard | undefined;

  // Free profiles need no payment details at all — the chat opens immediately.
  if (method === "card" && !isFree) {
    const result = validateCard(body);
    if (typeof result === "string") return fail(result);
    card = result;
  }

  try {
    const order = createOrder({ userId: user.id, modelId: model.id, method, card });
    return json(
      {
        ok: true,
        code: order.code,
        method,
        free: order.free,
        conversationId: order.conversationId,
        amountCents: model.price_cents,
        modelName: model.name,
      },
      201,
    );
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
