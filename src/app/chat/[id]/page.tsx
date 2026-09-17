import { notFound, redirect } from "next/navigation";

import { ChatThread } from "@/components/chat-thread";
import { ConversationList } from "@/components/conversation-list";
import { ConversionPixel } from "@/components/conversion-pixel";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";
import { claimConversionTracking, listConversationsForUser } from "@/lib/queries";
import { trackingEnabled } from "@/lib/tracking";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/chat/${id}`);

  const viewer = resolveChatViewer(user, conversationId);
  if (!viewer || viewer.role !== "user") notFound();

  const conversations = listConversationsForUser(user.id);
  // Counts as a conversion the first time this member opens this chat, once ever.
  const conversion = trackingEnabled() ? claimConversionTracking(conversationId) : null;

  return (
    <>
      {conversion && (
        <ConversionPixel transactionId={conversion.transactionId} description={conversion.description} />
      )}
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-3 pt-6 pb-8 sm:px-5">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="card hidden p-3 lg:block">
            <ConversationList
              initial={conversations}
              viewer="user"
              activeId={conversationId}
              basePath="/chat"
            />
          </div>

          <ChatThread
            conversationId={conversationId}
            viewer="user"
            backHref="/chat"
            balanceCents={user.balanceCents}
            guest={user.isGuest}
            partner={{
              name: viewer.conversation.modelName,
              avatar: viewer.conversation.modelCover,
              subtitle: viewer.conversation.modelOnline ? "Online now" : "Usually replies within the hour",
              online: !!viewer.conversation.modelOnline,
              profileHref: `/model/${viewer.conversation.modelSlug}`,
            }}
          />
        </div>
      </main>
    </>
  );
}
