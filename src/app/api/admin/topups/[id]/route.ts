import { fail, json } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { OrderError, decideTopup } from "@/lib/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("admin");
  if (!admin) return fail("Admin access required", 403);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { action?: "approve" | "reject" } | null;
  if (body?.action !== "approve" && body?.action !== "reject") return fail("Unknown action");

  try {
    decideTopup(Number(id), admin.id, body.action);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
