import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";
import { OrderError, requestPayment, sendGift } from "@/lib/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const viewer = resolveChatViewer(await getSessionUser(), conversationId);
  if (!viewer) return fail("Conversation not found", 404);

  const body = (await request.json().catch(() => null)) as
    | { action?: "request" | "gift"; amountCents?: number; note?: string }
    | null;
  const amount = Math.round(Number(body?.amountCents ?? 0));
  const note = typeof body?.note === "string" ? body.note.slice(0, 500) : null;

  try {
    if (body?.action === "request") {
      if (viewer.role !== "model") return fail("Only the profile can ask for a tip", 403);
      const messageId = requestPayment({ conversationId, amountCents: amount, note });
      return json({ ok: true, id: messageId }, 201);
    }

    if (body?.action === "gift") {
      if (viewer.role !== "user") return fail("Only members can send gifts", 403);
      const messageId = sendGift({
        conversationId,
        userId: viewer.conversation.userId,
        amountCents: amount,
        note,
      });
      return json({ ok: true, id: messageId }, 201);
    }

    return fail("Unknown action");
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
