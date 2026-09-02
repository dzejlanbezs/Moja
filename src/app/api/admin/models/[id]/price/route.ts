import { fail, json } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { OrderError, setModelPrice } from "@/lib/queries";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireRole("admin");
  if (!admin) return fail("Admin access required", 403);

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { priceCents?: number } | null;
  const price = Math.round(Number(body?.priceCents ?? Number.NaN));
  if (!Number.isFinite(price)) return fail("Enter a price");

  try {
    setModelPrice(Number(id), price);
    return json({ ok: true, priceCents: price, free: price === 0 });
  } catch (error) {
    if (error instanceof OrderError) return fail(error.message, 409);
    throw error;
  }
}
