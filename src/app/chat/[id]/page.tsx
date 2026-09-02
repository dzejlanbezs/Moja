import { notFound, redirect } from "next/navigation";

import { ChatThread } from "@/components/chat-thread";
import { ConversationList } from "@/components/conversation-list";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";
import { listConversationsForUser } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/chat/${id}`);

  const viewer = resolveChatViewer(user, conversationId);
  if (!viewer || viewer.role !== "user") notFound();

  const conversations = listConversationsForUser(user.id);

  return (
    <>
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
