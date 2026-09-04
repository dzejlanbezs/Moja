import { fail, json, saveImageUpload } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";
import { insertMessage, listMessages, listMoneyStatuses, markRead } from "@/lib/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const sessionUser = await getSessionUser();
  const viewer = resolveChatViewer(sessionUser, conversationId);
  if (!viewer) return fail("Conversation not found", 404);

  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? 0) || 0;
  const rows = listMessages(conversationId, after);
  markRead(conversationId, viewer.role);

  // Photos are a members-only perk: a guest sees that one arrived, not the picture itself.
  const locked = !!sessionUser?.isGuest;

  return json({
    messages: rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderRole: row.sender_role,
      body: row.body,
      imageUrl: locked ? null : row.image_url,
      imageLocked: locked && !!row.image_url,
      kind: row.kind ?? "text",
      amountCents: row.amount_cents,
      status: row.status,
      createdAt: row.created_at,
      mine: row.sender_role === viewer.role,
    })),
    // Tip requests change state after they are sent, so pollers get their current status too.
    money: listMoneyStatuses(conversationId),
    balanceCents: viewer.role === "user" ? viewer.conversation.userBalanceCents : undefined,
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const sessionUser = await getSessionUser();
  const viewer = resolveChatViewer(sessionUser, conversationId);
  if (!viewer) return fail("Conversation not found", 404);

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid request");

  const text = String(form.get("body") ?? "").trim();
  const file = form.get("image");
  let imageUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (sessionUser?.isGuest) return fail("Create a free account to send photos", 403);
    try {
      imageUrl = await saveImageUpload(file);
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Upload failed");
    }
  }

  if (!text && !imageUrl) return fail("Write a message or attach a photo");
  if (text.length > 4000) return fail("Message is too long");

  const messageId = insertMessage({
    conversationId,
    senderRole: viewer.role,
    body: text || null,
    imageUrl,
  });

  return json({ ok: true, id: messageId }, 201);
}
