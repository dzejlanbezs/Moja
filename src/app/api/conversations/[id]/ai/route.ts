import { isAiPaused, setAiPaused } from "@/lib/ai";
import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";

/** Only the profile herself can pause or resume the auto-replies in her chat. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const viewer = resolveChatViewer(await getSessionUser(), conversationId);
  if (!viewer || viewer.role !== "model") return fail("Conversation not found", 404);

  const body = (await request.json().catch(() => null)) as { paused?: boolean } | null;
  if (typeof body?.paused !== "boolean") return fail("Missing state");

  setAiPaused(conversationId, body.paused);
  return json({ ok: true, paused: isAiPaused(conversationId) });
}
