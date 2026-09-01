import { notFound, redirect } from "next/navigation";

import { ChatThread } from "@/components/chat-thread";
import { ConversationList } from "@/components/conversation-list";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { resolveChatViewer } from "@/lib/chat-access";
import { getModelByUserId, listConversationsForModel } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PortalThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conversationId = Number(id);
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  if (user.role !== "model") redirect("/");

  const viewer = resolveChatViewer(user, conversationId);
  if (!viewer || viewer.role !== "model") notFound();

  const model = getModelByUserId(user.id);
  const conversations = model ? listConversationsForModel(model.id) : [];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-3 pt-6 pb-8 sm:px-5">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="card hidden p-3 lg:block">
            <ConversationList
              initial={conversations}
              viewer="model"
              activeId={conversationId}
              basePath="/portal"
            />
          </div>

          <ChatThread
            conversationId={conversationId}
            viewer="model"
            backHref="/portal"
            partner={{
              name: viewer.conversation.userName,
              avatar: null,
              subtitle: `Member · ${viewer.conversation.userEmail}`,
            }}
          />
        </div>
      </main>
    </>
  );
}
