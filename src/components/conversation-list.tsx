"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ImageIcon, MessageCircle } from "lucide-react";

import { initials, relativeTime } from "@/lib/format";

export type ConversationItem = {
  id: number;
  modelName: string;
  modelSlug: string;
  modelCover: string | null;
  modelOnline: number;
  userName: string;
  userIsGuest: number;
  lastMessageAt: number;
  lastBody: string | null;
  lastImage: string | null;
  lastSender: string | null;
  unreadForUser: number;
  unreadForModel: number;
};

type Props = {
  initial: ConversationItem[];
  viewer: "user" | "model";
  activeId?: number;
  basePath: string;
};

export function ConversationList({ initial, viewer, activeId, basePath }: Props) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/conversations", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { conversations: ConversationItem[] };
        if (alive) setItems(data.conversations);
      } catch {
        /* best effort */
      }
    };
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
          <MessageCircle className="h-6 w-6 text-mist-500" />
        </span>
        <p className="mt-5 font-display text-2xl">No chats yet</p>
        <p className="mt-2 text-sm text-mist-500">
          {viewer === "user"
            ? "Unlock someone from the catalog and the conversation shows up here."
            : "As soon as a member unlocks you, their chat appears here."}
        </p>
        {viewer === "user" && (
          <Link href="/" className="btn-primary mt-6">
            Browse the catalog
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const unread = viewer === "user" ? item.unreadForUser : item.unreadForModel;
        const title = viewer === "user" ? item.modelName.split(" ")[0] : item.userName;
        const active = item.id === activeId;
        return (
          <Link
            key={item.id}
            href={`${basePath}/${item.id}`}
            className={`flex items-center gap-3.5 rounded-2xl border p-3 transition ${
              active
                ? "border-white/16 bg-white/10"
                : "border-transparent hover:border-white/10 hover:bg-white/5"
            }`}
          >
            <span className="relative shrink-0">
              {viewer === "user" && item.modelCover ? (
                <Image
                  src={item.modelCover}
                  alt={title}
                  width={52}
                  height={52}
                  className="h-13 w-13 rounded-2xl object-cover object-[center_18%]"
                />
              ) : (
                <span className="flex h-13 w-13 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-500 to-violet-500 text-sm font-semibold text-white">
                  {initials(title)}
                </span>
              )}
              {viewer === "user" && !!item.modelOnline && (
                <span className="absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-900 bg-emerald-400" />
              )}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium text-mist-100">{title}</span>
                  {viewer === "model" && !!item.userIsGuest && (
                    <span className="shrink-0 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      guest
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-mist-500">{relativeTime(item.lastMessageAt)}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-2">
                <span className="flex-1 truncate text-[13px] text-mist-500">
                  {item.lastImage && !item.lastBody ? (
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> Photo
                    </span>
                  ) : (
                    item.lastBody || "Say hello 👋"
                  )}
                </span>
                {unread > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-500 px-1.5 text-[11px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
