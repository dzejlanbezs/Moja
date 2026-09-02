import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { validateCard } from "@/lib/cards";
import { db } from "@/lib/db";
import { OrderError, createOrder } from "@/lib/queries";
import type { ModelRow } from "@/lib/types";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in first", 401);
  if (user.role !== "user") return fail("Only member accounts can unlock chats", 403);

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

  const method = body.method === "balance" ? "balance" : "card";
  let card: { brand: string; last4: string; name: string } | undefined;

  // Free profiles need no payment details at all — the chat opens immediately.
  if (method === "card" && model.price_cents > 0) {
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
