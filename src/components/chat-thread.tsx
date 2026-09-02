"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BadgeDollarSign, Gift, ImagePlus, Loader2, Send, Wallet, X } from "lucide-react";

import { formatPrice, formatTime, initials } from "@/lib/format";
import type { ChatMessage } from "@/lib/types";

type Props = {
  conversationId: number;
  viewer: "user" | "model";
  partner: { name: string; avatar: string | null; subtitle: string; online?: boolean; profileHref?: string };
  backHref: string;
  balanceCents?: number;
};

function dayLabel(ts: number) {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export function ChatThread({ conversationId, viewer, partner, backHref, balanceCents = 0 }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [balance, setBalance] = useState(balanceCents);
  const [money, setMoney] = useState<null | "request" | "gift">(null);
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyNote, setMoneyNote] = useState("");
  const [moneyBusy, setMoneyBusy] = useState(false);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [paying, setPaying] = useState<number | null>(null);

  const bottom = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const lastId = useRef(0);
  const polling = useRef(false);
  const stickToBottom = useRef(true);

  const poll = useCallback(async () => {
    // Overlapping polls (send + timer, or a remount) would otherwise append the same rows twice.
    if (polling.current) return;
    polling.current = true;
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages?after=${lastId.current}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        messages: ChatMessage[];
        money?: { id: number; status: string | null }[];
        balanceCents?: number;
      };
      if (typeof data.balanceCents === "number") setBalance(data.balanceCents);

      if (data.messages.length > 0) {
        lastId.current = Math.max(lastId.current, data.messages[data.messages.length - 1].id);
      }
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        const fresh = data.messages.filter((message) => !seen.has(message.id));
        const merged = fresh.length > 0 ? [...current, ...fresh] : current;
        // A tip request flips to "paid" long after it was sent, so statuses come along on every poll.
        const statuses = new Map((data.money ?? []).map((entry) => [entry.id, entry.status]));
        if (statuses.size === 0) return merged;
        let changed = fresh.length > 0;
        const next = merged.map((message) => {
          const status = statuses.get(message.id);
          if (status === undefined || status === message.status) return message;
          changed = true;
          return { ...message, status };
        });
        return changed ? next : current;
      });
    } finally {
      polling.current = false;
    }
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
      await flush();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSending(false);
    }
  }

  /** A timer poll may be mid-flight; wait it out so a just-sent message shows immediately. */
  async function flush() {
    for (let attempt = 0; attempt < 20 && polling.current; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    await poll();
  }

  async function submitMoney(event: React.FormEvent) {
    event.preventDefault();
    if (!money) return;
    const cents = Math.round(Number(moneyAmount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      setMoneyError("Enter an amount of at least $1");
      return;
    }
    setMoneyBusy(true);
    setMoneyError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/money`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: money, amountCents: cents, note: moneyNote }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMoneyError(data.error ?? "Could not send that");
        return;
      }
      if (money === "gift") setBalance((current) => current - cents);
      setMoney(null);
      setMoneyAmount("");
      setMoneyNote("");
      stickToBottom.current = true;
      await flush();
    } catch {
      setMoneyError("Network error — please try again");
    } finally {
      setMoneyBusy(false);
    }
  }

  async function payRequest(messageId: number) {
    setPaying(messageId);
    setError(null);
    try {
      const response = await fetch(`/api/messages/${messageId}/pay`, { method: "POST" });
      const data = (await response.json()) as { error?: string; amountCents?: number };
      if (!response.ok) {
        setError(data.error ?? "Payment failed");
        return;
      }
      setMessages((current) =>
        current.map((message) => (message.id === messageId ? { ...message, status: "paid" } : message)),
      );
      setBalance((current) => current - (data.amountCents ?? 0));
    } catch {
      setError("Network error — please try again");
    } finally {
      setPaying(null);
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
            className="h-11 w-11 rounded-2xl object-cover object-[center_18%]"
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
                  {message.kind === "request" ? (
                    <div className="overflow-hidden rounded-3xl border border-amber-300/30 bg-amber-400/10 shadow-lg backdrop-blur">
                      <div className="flex items-center gap-2 border-b border-amber-300/20 px-4 py-2 text-[11px] font-medium tracking-[0.14em] text-amber-200 uppercase">
                        <BadgeDollarSign className="h-3.5 w-3.5" />
                        {message.mine ? "You asked for a tip" : `${partner.name.split(" ")[0]} asks for a tip`}
                      </div>
                      <div className="px-4 py-3">
                        <p className="font-display text-4xl text-white">{formatPrice(message.amountCents ?? 0)}</p>
                        {message.body && (
                          <p className="mt-1.5 text-[15px] whitespace-pre-wrap text-mist-100">{message.body}</p>
                        )}

                        {message.status === "paid" ? (
                          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-300">
                            ✓ Paid
                          </p>
                        ) : viewer === "user" ? (
                          <button
                            onClick={() => payRequest(message.id)}
                            disabled={paying === message.id}
                            className="btn-primary mt-3 w-full !py-2.5 text-sm"
                          >
                            {paying === message.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wallet className="h-4 w-4" />
                            )}
                            PAY {formatPrice(message.amountCents ?? 0)}
                          </button>
                        ) : (
                          <p className="mt-3 text-xs text-amber-200/80">Waiting for payment</p>
                        )}
                      </div>
                    </div>
                  ) : message.kind === "gift" ? (
                    <div className="overflow-hidden rounded-3xl border border-violet-300/30 bg-violet-500/15 shadow-lg backdrop-blur">
                      <div className="flex items-center gap-2 border-b border-violet-300/20 px-4 py-2 text-[11px] font-medium tracking-[0.14em] text-violet-200 uppercase">
                        <Gift className="h-3.5 w-3.5" />
                        {message.mine ? "Gift sent" : "Gift received"}
                      </div>
                      <div className="px-4 py-3">
                        <p className="font-display text-4xl text-white">{formatPrice(message.amountCents ?? 0)}</p>
                        {message.body && (
                          <p className="mt-1.5 text-[15px] whitespace-pre-wrap text-mist-100">{message.body}</p>
                        )}
                      </div>
                    </div>
                  ) : (
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
                            // A photo growing into place after the scroll would hide the newest messages.
                            onLoad={() => {
                              if (stickToBottom.current) bottom.current?.scrollIntoView({ block: "end" });
                            }}
                            className="max-h-80 w-full cursor-zoom-in object-cover"
                          />
                        </button>
                      )}
                      {message.body && <p className="px-4 py-2.5 whitespace-pre-wrap">{message.body}</p>}
                    </div>
                  )}
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

        {error && (
          <p className="mb-3 text-sm text-blush-400">
            {error}
            {error.toLowerCase().includes("balance") && viewer === "user" && (
              <Link href="/topup" className="ml-1 font-medium underline underline-offset-4">
                Top up your balance
              </Link>
            )}
          </p>
        )}

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

          {viewer === "model" ? (
            <button
              type="button"
              onClick={() => {
                setMoney("request");
                setMoneyError(null);
              }}
              className="btn h-11 shrink-0 border border-amber-300/30 bg-amber-400/10 !px-4 text-amber-200 hover:bg-amber-400/18"
              title="Ask for a tip"
            >
              <BadgeDollarSign className="h-4.5 w-4.5" />
              <span className="hidden sm:inline">Tip</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMoney("gift");
                setMoneyError(null);
              }}
              className="btn h-11 shrink-0 border border-violet-300/30 bg-violet-500/15 !px-4 text-violet-200 hover:bg-violet-500/25"
              title="Send a gift"
            >
              <Gift className="h-4.5 w-4.5" />
              <span className="hidden sm:inline">Gift</span>
            </button>
          )}

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
          Enter to send · Shift + Enter for a new line ·{" "}
          {viewer === "model" ? "you are replying as talent" : `balance ${formatPrice(balance)}`}
        </p>
      </form>

      {money && (
        <div
          className="fixed inset-0 z-100 flex items-end justify-center bg-ink-950/80 p-4 backdrop-blur-md sm:items-center"
          onClick={() => !moneyBusy && setMoney(null)}
        >
          <form
            onSubmit={submitMoney}
            onClick={(event) => event.stopPropagation()}
            className="glass-strong w-full max-w-md animate-pop rounded-[28px] p-6 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="chip">{money === "request" ? "Tip request" : "Send a gift"}</span>
                <h3 className="mt-3 font-display text-3xl">
                  {money === "request"
                    ? `Ask ${partner.name.split(" ")[0]} for a tip`
                    : `Gift ${partner.name.split(" ")[0]}`}
                </h3>
                <p className="mt-1 text-sm text-mist-500">
                  {money === "request"
                    ? "She sees the amount in the chat with a PAY button."
                    : `Sent straight from your balance of ${formatPrice(balance)}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMoney(null)}
                className="btn-ghost h-9 w-9 shrink-0 !px-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-6">
              <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 font-display text-3xl text-mist-500">
                $
              </span>
              <input
                autoFocus
                inputMode="decimal"
                value={moneyAmount}
                onChange={(event) => setMoneyAmount(event.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="20"
                aria-label="Amount in dollars"
                className="field !rounded-2xl !py-4 !pl-12 font-display !text-3xl"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[10, 20, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setMoneyAmount(String(preset))}
                  className="btn-soft !px-4 !py-2 text-xs"
                >
                  ${preset}
                </button>
              ))}
            </div>

            <div className="mt-5">
              <label className="label" htmlFor="money-note">
                Note {money === "gift" ? "(optional)" : "(optional)"}
              </label>
              <input
                id="money-note"
                value={moneyNote}
                onChange={(event) => setMoneyNote(event.target.value)}
                placeholder={money === "gift" ? "Have a great evening!" : "For the photo set"}
                className="field"
              />
            </div>

            {moneyError && (
              <p className="mt-4 rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
                {moneyError}
                {moneyError.toLowerCase().includes("balance") && (
                  <Link href="/topup" className="ml-1 underline underline-offset-4">
                    Top up now
                  </Link>
                )}
              </p>
            )}

            <button type="submit" disabled={moneyBusy} className="btn-primary mt-6 w-full !py-3.5">
              {moneyBusy ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : money === "request" ? (
                <BadgeDollarSign className="h-4.5 w-4.5" />
              ) : (
                <Gift className="h-4.5 w-4.5" />
              )}
              {money === "request" ? "Send request" : "Send gift"}
            </button>
          </form>
        </div>
      )}

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
