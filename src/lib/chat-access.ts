import "server-only";

import { getConversation, getModelByUserId } from "@/lib/queries";
import type { SessionUser } from "@/lib/types";

export type ChatViewer = {
  role: "user" | "model";
  conversation: NonNullable<ReturnType<typeof getConversation>>;
  /** Name shown at the top of the thread — the counterparty. */
  partnerName: string;
  partnerAvatar: string | null;
};

export function resolveChatViewer(user: SessionUser | null, conversationId: number): ChatViewer | null {
  if (!user) return null;
  const conversation = getConversation(conversationId);
  if (!conversation) return null;

  if (user.role === "user" && conversation.userId === user.id) {
    return {
      role: "user",
      conversation,
      partnerName: conversation.modelName,
      partnerAvatar: conversation.modelCover,
    };
  }

  if (user.role === "model") {
    const model = getModelByUserId(user.id);
    if (model && model.id === conversation.modelId) {
      return { role: "model", conversation, partnerName: conversation.userName, partnerAvatar: null };
    }
  }

  return null;
}
