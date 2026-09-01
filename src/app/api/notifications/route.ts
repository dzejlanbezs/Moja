import { json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getModelByUserId, pendingOrdersCount, unreadCountForModel, unreadCountForUser } from "@/lib/queries";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return json({ unread: 0, pending: 0, balanceCents: 0 });

  if (user.role === "user") {
    return json({ unread: unreadCountForUser(user.id), pending: 0, balanceCents: user.balanceCents });
  }
  if (user.role === "model") {
    const model = getModelByUserId(user.id);
    return json({ unread: model ? unreadCountForModel(model.id) : 0, pending: 0, balanceCents: 0 });
  }
  return json({ unread: 0, pending: pendingOrdersCount(), balanceCents: 0 });
}
