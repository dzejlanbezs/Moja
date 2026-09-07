"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle, X } from "lucide-react";

/* ───────────────────────────  EDIT EVERYTHING HERE  ─────────────────────────── */

const POPUP = {
  /** Profile the button opens. Set her catalog price to 0 (FREE) so the chat opens instantly. */
  modelSlug: "rina-alvarez",
  /** Seconds to wait after the page loads before the popup appears. */
  delaySeconds: 5,
  /** Countdown length, in minutes. The popup closes itself when it runs out. */
  countdownMinutes: 7,
  /** Show it once per browser session. Set to false to show it on every page load. */
  oncePerSession: true,

  title: "Chloe is horny!",
  /** Any image in /public — for example "/my-popup.png" or a profile poster. */
  image: "/models/rina-alvarez-1.webp",
  message: "Chloe is horny! She is looking for someone rightnow!",
  offerLabel: "Custom Video for...",
  price: "$10",
  buttonLabel: "Talk to Her!",
  dismissLabel: "Maybe later",

  /** Pages where it should never appear. */
  hiddenOn: ["/chat", "/admin", "/portal", "/login", "/register", "/topup", "/unlock"],
};

/* ─────────────────────────────────────────────────────────────────────────────── */

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function HotPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(POPUP.countdownMinutes * 60);
  const [busy, setBusy] = useState(false);

  const blocked = POPUP.hiddenOn.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const close = useCallback(() => {
    setOpen(false);
    if (POPUP.oncePerSession) {
      try {
        sessionStorage.setItem("aurea_popup_seen", "1");
      } catch {
        /* private mode — just show it again next time */
      }
    }
  }, []);

  // Appear once, a few seconds in.
  useEffect(() => {
    if (blocked) return;
    let seen = false;
    try {
      seen = POPUP.oncePerSession && sessionStorage.getItem("aurea_popup_seen") === "1";
    } catch {
      seen = false;
    }
    if (seen) return;

    const timer = setTimeout(() => setOpen(true), POPUP.delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [blocked]);

  // Countdown, and close when the offer runs out.
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          close();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [open, close]);

  // Escape closes it, and the page behind it should not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  /** Opens her chat straight away — works for guests and for signed-in members. */
  async function openChat() {
    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: POPUP.modelSlug }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        conversationId?: number | null;
        error?: string;
      };

      if (response.ok && data.conversationId) {
        close();
        router.push(`/chat/${data.conversationId}`);
        return;
      }

      // Already unlocked earlier: find that conversation and jump into it.
      const existing = await fetch("/api/conversations", { cache: "no-store" });
      if (existing.ok) {
        const list = (await existing.json()) as {
          conversations: { id: number; modelSlug: string }[];
        };
        const match = list.conversations.find((item) => item.modelSlug === POPUP.modelSlug);
        if (match) {
          close();
          router.push(`/chat/${match.id}`);
          return;
        }
      }

      // Paid profile or something unexpected — send them to her page instead.
      close();
      router.push(`/model/${POPUP.modelSlug}`);
    } catch {
      close();
      router.push(`/model/${POPUP.modelSlug}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open || blocked) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={POPUP.title}
      onClick={close}
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <style>{`
        @keyframes aureaPopupIn {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        @keyframes aureaPopupGlow {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,61,127,0.35), 0 0 60px -12px rgba(255,61,127,0.75), 0 0 120px -30px rgba(139,92,246,0.8); }
          50% { box-shadow: 0 0 0 1px rgba(167,139,250,0.45), 0 0 80px -10px rgba(255,61,127,0.95), 0 0 160px -30px rgba(139,92,246,0.95); }
        }
        @keyframes aureaRingPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        .aurea-popup-card { animation: aureaPopupIn .32s cubic-bezier(.22,1,.36,1) both, aureaPopupGlow 3.2s ease-in-out infinite; }
        .aurea-popup-ring { animation: aureaRingPulse 2.4s ease-in-out infinite; }
      `}</style>

      <div
        onClick={(event) => event.stopPropagation()}
        className="aurea-popup-card relative w-full max-w-[420px] rounded-[28px] border border-white/10 bg-[#0b0714] p-7 text-center sm:p-8"
      >
        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-mist-300 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="mt-2 text-[11px] font-semibold tracking-[0.22em] text-blush-400 uppercase">Online now</p>

        <h2 className="mt-2 bg-gradient-to-r from-white via-[#ffb3cd] to-[#b79bff] bg-clip-text font-display text-4xl leading-tight text-transparent">
          {POPUP.title}
        </h2>

        <div className="relative mx-auto mt-5 h-28 w-28">
          <span className="aurea-popup-ring absolute -inset-2 rounded-full border border-blush-500/50" />
          <span className="absolute -inset-5 rounded-full bg-blush-500/20 blur-2xl" />
          <Image
            src={POPUP.image}
            alt={POPUP.title}
            width={112}
            height={112}
            unoptimized
            className="relative h-28 w-28 rounded-full border-2 border-blush-500/60 object-cover object-[center_18%]"
          />
          <span className="absolute right-1 bottom-1 h-4 w-4 rounded-full border-2 border-[#0b0714] bg-emerald-400" />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/4 px-5 py-4">
          <p className="text-[11px] font-medium tracking-[0.18em] text-mist-500 uppercase">Offer ends in</p>
          <p className="mt-1 font-display text-4xl text-white tabular-nums drop-shadow-[0_0_18px_rgba(255,61,127,0.55)]">
            {formatClock(secondsLeft)}
          </p>
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-mist-300">{POPUP.message}</p>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/4 px-5 py-4">
          <p className="text-[11px] font-medium tracking-[0.18em] text-mist-500 uppercase">{POPUP.offerLabel}</p>
          <p className="mt-1 font-display text-5xl text-white drop-shadow-[0_0_22px_rgba(255,61,127,0.6)]">
            {POPUP.price}
          </p>
        </div>

        <button
          onClick={openChat}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blush-500 to-violet-500 px-6 py-4 text-base font-semibold text-white shadow-[0_14px_40px_-10px_rgba(255,61,127,0.95)] transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
          {POPUP.buttonLabel}
        </button>

        <button onClick={close} className="mt-3 w-full text-sm text-mist-500 transition hover:text-mist-300">
          {POPUP.dismissLabel}
        </button>
      </div>
    </div>
  );
}
