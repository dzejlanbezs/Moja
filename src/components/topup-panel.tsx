"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";

import { CardForm, emptyCard, type CardState } from "@/components/card-form";
import { formatPrice } from "@/lib/format";

const PRESETS = [25, 50, 100, 250];

export function TopupPanel({ balanceCents, minCents }: { balanceCents: number; minCents: number }) {
  const [step, setStep] = useState<"amount" | "card">("amount");
  const [amount, setAmount] = useState("");
  const [card, setCard] = useState<CardState>(emptyCard);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; amountCents: number } | null>(null);

  const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
  const validAmount = Number.isFinite(amountCents) && amountCents >= minCents;

  function confirmAmount(event: React.FormEvent) {
    event.preventDefault();
    if (!validAmount) {
      setError(`The minimum top-up is ${formatPrice(minCents)}`);
      return;
    }
    setError(null);
    setStep("card");
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          cardNumber: card.number,
          cardName: card.name,
          expiry: card.expiry,
          cvc: card.cvc,
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        setError(data.error ?? "Top-up could not be submitted");
        return;
      }
      setDone({ code: data.code!, amountCents });
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="glass-strong mx-auto max-w-xl animate-pop rounded-[30px] p-8 text-center sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-300" />
        </span>
        <h2 className="mt-6 font-display text-4xl">Top-up received</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mist-300">
          Your top-up <span className="font-medium text-white">{done.code}</span> of{" "}
          <span className="font-medium text-white">{formatPrice(done.amountCents)}</span> is with our team. As soon
          as an admin approves it, the money lands in your balance.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/account" className="btn-primary !px-7 !py-3.5">
            Track it in my account
          </Link>
          <Link href="/" className="btn-ghost !px-7 !py-3.5">
            Back to the catalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
      {step === "amount" ? (
        <form onSubmit={confirmAmount} className="glass-strong rounded-[30px] p-6 sm:p-8">
          <span className="chip">Step 1 of 2 · amount</span>
          <h2 className="mt-4 font-display text-3xl">How much do you want to add?</h2>
          <p className="mt-2 text-sm text-mist-500">
            Minimum {formatPrice(minCents)}. Type any amount you like.
          </p>

          <div className="relative mt-7">
            <span className="pointer-events-none absolute top-1/2 left-5 -translate-y-1/2 font-display text-3xl text-mist-500">
              $
            </span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d.,]/g, ""))}
              placeholder="25"
              aria-label="Top-up amount in dollars"
              className="field !rounded-2xl !py-5 !pl-12 font-display !text-3xl"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`btn !px-4 !py-2 border ${
                  Number(amount) === preset
                    ? "border-blush-500/50 bg-blush-500/15 text-white"
                    : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={!validAmount} className="btn-primary mt-7 w-full !py-4 text-base">
            Confirm {validAmount ? formatPrice(amountCents) : ""} <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <form onSubmit={pay} className="glass-strong rounded-[30px] p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <span className="chip">Step 2 of 2 · card</span>
            <button
              type="button"
              onClick={() => setStep("amount")}
              className="inline-flex items-center gap-1.5 text-sm text-mist-500 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change amount
            </button>
          </div>

          <h2 className="mt-4 font-display text-3xl">Pay {formatPrice(amountCents)}</h2>
          <p className="mt-2 mb-7 text-sm text-mist-500">
            The exact amount you entered is charged to this card.
          </p>

          <CardForm value={card} onChange={setCard} idPrefix="topup" />

          {error && (
            <p className="mt-5 rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary mt-7 w-full !py-4 text-base">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4.5 w-4.5" />}
            {busy ? "Processing" : `Pay ${formatPrice(amountCents)}`}
          </button>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mist-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Demo checkout — no real card is ever charged.
          </p>
        </form>
      )}

      <aside className="space-y-5">
        <div className="card p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-white/10">
            <Wallet className="h-5 w-5 text-violet-300" />
          </span>
          <p className="mt-5 text-xs tracking-[0.14em] text-mist-500 uppercase">Current balance</p>
          <p className="mt-1 font-display text-4xl">{formatPrice(balanceCents)}</p>
          {validAmount && (
            <p className="mt-3 text-sm text-mist-500">
              After approval:{" "}
              <span className="font-medium text-emerald-300">{formatPrice(balanceCents + amountCents)}</span>
            </p>
          )}
        </div>

        <div className="card space-y-4 p-6 text-sm text-mist-500">
          <p className="text-[11px] tracking-[0.14em] text-mist-500 uppercase">What balance is for</p>
          <p>Unlock chats in one tap, pay a tip request, or send a gift — all without typing a card again.</p>
          <p>Every top-up is confirmed by our team before it lands in your wallet.</p>
        </div>
      </aside>
    </div>
  );
}
