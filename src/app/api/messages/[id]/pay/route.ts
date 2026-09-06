import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { notifyTipPaid } from "@/lib/pushover";
import { OrderError, payRequest } from "@/lib/queries";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return fail("Please sign in first", 401);
  if (user.role !== "user") return fail("Only members can pay a request", 403);

  const { id } = await params;
  try {
    const paid = payRequest(Number(id), user.id);

    notifyTipPaid({
      modelName: paid.modelName,
      memberName: paid.memberName,
      amountCents: paid.amountCents,
    });

    return json({ ok: true, amountCents: paid.amountCents });
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
