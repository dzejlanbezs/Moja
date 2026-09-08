import { fail, json } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { OrderError, approveOrder, getOrder, rejectOrder } from "@/lib/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("admin");
  if (!admin) return fail("Admin access required", 403);

  const { id } = await params;
  const orderId = Number(id);
  const body = (await request.json().catch(() => null)) as { action?: "approve" | "reject" } | null;

  try {
    if (body?.action === "approve") {
      const conversationId = approveOrder(orderId, admin.id);
      return json({ ok: true, conversationId, order: getOrder(orderId) });
    }
    if (body?.action === "reject") {
      rejectOrder(orderId, admin.id);
      return json({ ok: true, order: getOrder(orderId) });
    }
    return fail("Unknown action");
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
