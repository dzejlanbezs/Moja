import { fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { getModelByUserId, listConversationsForModel, listConversationsForUser } from "@/lib/queries";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Not signed in", 401);

  if (user.role === "user") return json({ conversations: listConversationsForUser(user.id) });

  if (user.role === "model") {
    const model = getModelByUserId(user.id);
    if (!model) return json({ conversations: [] });
    return json({ conversations: listConversationsForModel(model.id) });
  }

  return fail("Not available for this account", 403);
}
