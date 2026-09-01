import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { OrderError, createOrder } from "@/lib/queries";
import type { ModelRow } from "@/lib/types";

function cardBrand(number: string) {
  if (/^4/.test(number)) return "VISA";
  if (/^5[1-5]/.test(number)) return "MASTERCARD";
  if (/^3[47]/.test(number)) return "AMEX";
  if (/^6/.test(number)) return "DISCOVER";
  return "CARD";
}

function luhn(number: string) {
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

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

  if (method === "card") {
    const digits = (body.cardNumber ?? "").replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19 || !luhn(digits)) return fail("That card number looks invalid");
    if (!body.cardName?.trim()) return fail("Enter the name on the card");
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(body.expiry ?? "")) return fail("Expiry must look like MM/YY");
    if (!/^\d{3,4}$/.test(body.cvc ?? "")) return fail("CVC must be 3 or 4 digits");
    card = { brand: cardBrand(digits), last4: digits.slice(-4), name: body.cardName.trim().toUpperCase() };
  }

  try {
    const { code } = createOrder({ userId: user.id, modelId: model.id, method, card });
    return json({ ok: true, code, method, amountCents: model.price_cents, modelName: model.name }, 201);
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
