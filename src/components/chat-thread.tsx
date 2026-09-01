"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, Send, X } from "lucide-react";

import { formatTime, initials } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

type Props = {
  conversationId: number;
  viewer: "user" | "model";
  partner: { name: string; avatar: string | null; subtitle: string; online?: boolean; profileHref?: string };
  backHref: string;
};

function dayLabel(ts: number) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function ChatThread({ conversationId, viewer, partner, backHref }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const bottom = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const lastId = useRef(0);
  const stickToBottom = useRef(true);

  const poll = useCallback(async () => {
    const response = await fetch(`/api/conversations/${conversationId}/messages?after=${lastId.current}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { messages: ChatMessage[] };
    if (data.messages.length === 0) return;
    lastId.current = data.messages[data.messages.length - 1].id;
    setMessages((current) => [...current, ...data.messages]);
  }, [conversationId]);

  useEffect(() => {
    let alive = true;
    poll().finally(() => alive && setLoaded(true));
    const timer = setInterval(() => {
      if (alive) poll().catch(() => undefined);
    }, 2500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [poll]);

  useEffect(() => {
    if (!stickToBottom.current) return;
    bottom.current?.scrollIntoView({ behavior: messages.length > 12 ? "smooth" : "auto", block: "end" });
  }, [messages]);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (sending || (!text.trim() && !file)) return;
    setSending(true);
    setError(null);

    const form = new FormData();
    form.set("body", text);
    if (file) form.set("image", file);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Message could not be sent");
        return;
      }
      setText("");
      setFile(null);
      stickToBottom.current = true;
      await poll();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass-strong flex h-[calc(100dvh-9.5rem)] min-h-[520px] flex-col overflow-hidden rounded-[28px]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-4 py-3.5 sm:px-5">
        <Link href={backHref} className="btn-ghost h-9 w-9 !px-0 lg:hidden" aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {partner.avatar ? (
          <Image
            src={partner.avatar}
            alt={partner.name}
            width={44}
            height={44}
            className="h-11 w-11 rounded-2xl object-cover"
          />
        ) : (
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-500 to-violet-500 text-sm font-semibold text-white">
            {initials(partner.name)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-mist-100">{partner.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-mist-500">
            {partner.online && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            {partner.subtitle}
          </p>
        </div>

        {partner.profileHref && (
          <Link href={partner.profileHref} className="btn-ghost !px-4 !py-2 text-xs">
            View profile
          </Link>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
        }}
        className="scroll-thin flex-1 space-y-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        {!loaded && (
          <div className="flex h-full items-center justify-center text-sm text-mist-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading conversation
          </div>
        )}

        {loaded && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="font-display text-2xl">Say hello to {partner.name.split(" ")[0]}</p>
            <p className="mt-2 max-w-xs text-sm text-mist-500">
              This chat is private. Messages and photos stay between the two of you.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
          return (
            <div key={message.id}>
              {newDay && (
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/8" />
                  <span className="text-[11px] tracking-[0.12em] text-mist-500 uppercase">
                    {dayLabel(message.createdAt)}
                  </span>
                  <span className="h-px flex-1 bg-white/8" />
                </div>
              )}

              <div className={`flex animate-pop ${message.mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] sm:max-w-[68%] ${message.mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`overflow-hidden rounded-3xl text-[15px] leading-relaxed shadow-lg ${
                      message.mine
                        ? "rounded-br-lg bg-gradient-to-br from-blush-500 to-violet-500 text-white"
                        : "rounded-bl-lg border border-white/10 bg-white/8 text-mist-100 backdrop-blur"
                    }`}
                  >
                    {message.imageUrl && (
                      <button onClick={() => setLightbox(message.imageUrl)} className="block">
                        <Image
                          src={message.imageUrl}
                          alt="Shared photo"
                          width={420}
                          height={420}
                          className="max-h-80 w-full cursor-zoom-in object-cover"
                        />
                      </button>
                    )}
                    {message.body && <p className="px-4 py-2.5 whitespace-pre-wrap">{message.body}</p>}
                  </div>
                  <p
                    className={`mt-1 px-1 text-[11px] text-mist-500 ${message.mine ? "text-right" : "text-left"}`}
                  >
                    {formatTime(message.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="border-t border-white/8 px-3 py-3 sm:px-5 sm:py-4">
        {preview && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
            <Image src={preview} alt="" width={48} height={48} className="h-12 w-12 rounded-xl object-cover" />
            <span className="flex-1 truncate text-sm text-mist-300">{file?.name}</span>
            <button type="button" onClick={() => setFile(null)} className="btn-ghost h-8 w-8 !px-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && <p className="mb-3 text-sm text-blush-400">{error}</p>}

        <div className="flex items-end gap-2">
          <label className="btn-ghost h-11 w-11 shrink-0 cursor-pointer !px-0" title="Send a photo">
            <ImagePlus className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(event as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder={`Message ${partner.name.split(" ")[0]}…`}
            className="field scroll-thin max-h-32 min-h-11 flex-1 resize-none !rounded-2xl !py-3"
          />

          <button
            type="submit"
            disabled={sending || (!text.trim() && !file)}
            className="btn-primary h-11 w-11 shrink-0 !px-0"
            aria-label="Send message"
          >
            {sending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Send className="h-4.5 w-4.5" />}
          </button>
        </div>
        <p className="mt-2 hidden px-1 text-[11px] text-mist-500 sm:block">
          Enter to send · Shift + Enter for a new line · {viewer === "model" ? "you are replying as talent" : "photos are private"}
        </p>
      </form>

      {lightbox && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-ink-950/92 p-6 backdrop-blur-xl"
          onClick={() => setLightbox(null)}
        >
          <div className="relative h-full max-h-[85vh] w-full max-w-3xl animate-pop">
            <Image src={lightbox} alt="" fill sizes="90vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
