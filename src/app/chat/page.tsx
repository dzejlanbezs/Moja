import Link from "next/link";
import { redirect } from "next/navigation";
import { MessagesSquare } from "lucide-react";

import { ConversationList } from "@/components/conversation-list";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { listConversationsForUser } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "My chats" };

export default async function ChatIndexPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/chat");
  if (user.role === "model") redirect("/portal");
  if (user.role === "admin") redirect("/admin");

  const conversations = listConversationsForUser(user.id);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5 pt-8 pb-12">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip">Private inbox</span>
            <h1 className="mt-4 font-display text-5xl leading-none">Your chats</h1>
            <p className="mt-2 text-[15px] text-mist-500">
              {conversations.length === 0
                ? "Unlocked conversations land here."
                : `${conversations.length} unlocked ${conversations.length === 1 ? "conversation" : "conversations"}`}
            </p>
          </div>
          <Link href="/#catalog" className="btn-ghost">
            Find someone new
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="card p-3">
            <ConversationList initial={conversations} viewer="user" basePath="/chat" />
          </div>

          <div className="card hidden flex-col items-center justify-center p-16 text-center lg:flex">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5">
              <MessagesSquare className="h-7 w-7 text-mist-500" />
            </span>
            <p className="mt-6 font-display text-3xl">Pick a conversation</p>
            <p className="mt-2 max-w-sm text-sm text-mist-500">
              Select someone on the left to continue talking, or unlock a new profile from the catalog.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
