import { fail, json, saveImageUpload } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";
import { insertMessage, listMessages, markRead } from "@/lib/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const viewer = resolveChatViewer(await getSessionUser(), conversationId);
  if (!viewer) return fail("Conversation not found", 404);

  const url = new URL(request.url);
  const after = Number(url.searchParams.get("after") ?? 0) || 0;
  const rows = listMessages(conversationId, after);
  markRead(conversationId, viewer.role);

  return json({
    messages: rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderRole: row.sender_role,
      body: row.body,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      mine: row.sender_role === viewer.role,
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const viewer = resolveChatViewer(await getSessionUser(), conversationId);
  if (!viewer) return fail("Conversation not found", 404);

  const form = await request.formData().catch(() => null);
  if (!form) return fail("Invalid request");

  const text = String(form.get("body") ?? "").trim();
  const file = form.get("image");
  let imageUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
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
