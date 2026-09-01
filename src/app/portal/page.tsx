import Image from "next/image";
import { redirect } from "next/navigation";
import { MessagesSquare, Star, Users } from "lucide-react";

import { ConversationList } from "@/components/conversation-list";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getModelByUserId, listConversationsForModel, unreadCountForModel } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Talent inbox" };

export default async function PortalPage() {
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  if (user.role !== "model") redirect("/");

  const model = getModelByUserId(user.id);
  if (!model) redirect("/");

  const conversations = listConversationsForModel(model.id);
  const unread = unreadCountForModel(model.id);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5 pt-8 pb-12">
        <div className="glass-strong mb-7 flex flex-col gap-6 rounded-[28px] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            {user.avatarUrl && (
              <Image
                src={user.avatarUrl}
                alt={model.name}
                width={72}
                height={72}
                className="h-18 w-18 rounded-3xl object-cover object-[center_18%]"
              />
            )}
            <div>
              <span className="chip">Talent portal</span>
              <h1 className="mt-2 font-display text-4xl leading-none">{model.name}</h1>
              <p className="mt-1 text-sm text-mist-500">
                {model.city}, {model.country} · {formatPrice(model.price_cents)} per unlock
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-8">
            {[
              { icon: Users, value: conversations.length, label: "Members" },
              { icon: MessagesSquare, value: unread, label: "Unread" },
              { icon: Star, value: model.rating.toFixed(1), label: "Rating" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <stat.icon className="mx-auto h-4 w-4 text-blush-400" />
                <p className="mt-2 font-display text-3xl">{stat.value}</p>
                <p className="text-[11px] tracking-[0.12em] text-mist-500 uppercase">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="card p-3">
            <ConversationList initial={conversations} viewer="model" basePath="/portal" />
          </div>

          <div className="card hidden flex-col items-center justify-center p-16 text-center lg:flex">
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5">
              <MessagesSquare className="h-7 w-7 text-mist-500" />
            </span>
            <p className="mt-6 font-display text-3xl">Choose a member</p>
            <p className="mt-2 max-w-sm text-sm text-mist-500">
              Every member on the left paid to talk to you. Reply with messages or photos.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
