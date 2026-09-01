"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";

import { formatPrice } from "@/lib/format";

type Props = {
  model: { slug: string; name: string; cover: string; priceCents: number; city: string; age: number };
  balanceCents: number;
};

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function brandOf(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^4/.test(digits)) return "VISA";
  if (/^5[1-5]/.test(digits)) return "MASTERCARD";
  if (/^3[47]/.test(digits)) return "AMEX";
  if (/^6/.test(digits)) return "DISCOVER";
  return "CARD";
}

export function PaymentPanel({ model, balanceCents }: Props) {
  const [method, setMethod] = useState<"card" | "balance">("card");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string } | null>(null);

  const enoughBalance = balanceCents >= model.priceCents;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: model.slug,
          method,
          cardNumber: number,
          cardName: name,
          expiry,
          cvc,
        }),
      });
      const data = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        setError(data.error ?? "Payment could not be submitted");
        return;
      }
      // No router.refresh() here: this route redirects once an order is pending,
      // which would replace the confirmation screen the member needs to see.
      setDone({ code: data.code! });
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="glass-strong animate-pop rounded-[30px] p-8 text-center sm:p-12">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-300" />
        </span>
        <h2 className="mt-6 font-display text-4xl">Payment received</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mist-300">
          Your payment <span className="font-medium text-white">{done.code}</span> for {model.name.split(" ")[0]} is
          now with our team. As soon as an admin approves it, the chat appears in your inbox.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/chat" className="btn-primary !px-7 !py-3.5">
            Go to my chats
          </Link>
          <Link href="/account" className="btn-ghost !px-7 !py-3.5">
            Track payment status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={submit} className="glass-strong order-2 rounded-[30px] p-6 sm:p-8 lg:order-1">
        <div className="flex gap-2 rounded-2xl bg-white/5 p-1.5">
          {(
            [
              { key: "card", label: "Pay by card", icon: CreditCard },
              { key: "balance", label: "Use balance", icon: Wallet },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMethod(tab.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition ${
                method === tab.key ? "bg-white/12 text-white shadow-lg" : "text-mist-500 hover:text-mist-100"
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>

        {method === "card" ? (
          <div className="mt-7 space-y-5">
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-blush-600 via-[#8b2bd6] to-violet-500 p-6 shadow-[0_30px_60px_-30px_rgba(255,61,127,0.8)]">
              <div className="absolute -top-16 -right-10 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
              <div className="flex items-start justify-between">
                <div className="h-9 w-12 rounded-md bg-gradient-to-br from-amber-200/90 to-amber-400/70" />
                <span className="text-sm font-semibold tracking-[0.18em] text-white/90">{brandOf(number)}</span>
              </div>
              <p className="mt-7 font-mono text-lg tracking-[0.14em] text-white">
                {formatCardNumber(number) || "•••• •••• •••• ••••"}
              </p>
              <div className="mt-6 flex items-end justify-between text-white/85">
                <div>
                  <p className="text-[10px] tracking-[0.14em] uppercase opacity-70">Card holder</p>
                  <p className="text-sm tracking-wide uppercase">{name || "YOUR NAME"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] tracking-[0.14em] uppercase opacity-70">Expires</p>
                  <p className="text-sm">{expiry || "MM/YY"}</p>
                </div>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="card-number">
                Card number
              </label>
              <input
                id="card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                className="field font-mono tracking-widest"
                placeholder="4242 4242 4242 4242"
                value={formatCardNumber(number)}
                onChange={(event) => setNumber(event.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="card-name">
                Name on card
              </label>
              <input
                id="card-name"
                autoComplete="cc-name"
                className="field"
                placeholder="Alex Morgan"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="card-expiry">
                  Expiry
                </label>
                <input
                  id="card-expiry"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  className="field"
                  placeholder="09/28"
                  value={expiry}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                    setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="card-cvc">
                  CVC
                </label>
                <input
                  id="card-cvc"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  className="field"
                  placeholder="123"
                  value={cvc}
                  onChange={(event) => setCvc(event.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-7">
            <div className="card flex items-center justify-between p-6">
              <div>
                <p className="text-xs tracking-[0.14em] text-mist-500 uppercase">Aurea balance</p>
                <p className="mt-2 font-display text-4xl">{formatPrice(balanceCents)}</p>
              </div>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-white/10">
                <Wallet className="h-6 w-6 text-violet-300" />
              </span>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between text-mist-300">
                <span>Chat with {model.name.split(" ")[0]}</span>
                <span>−{formatPrice(model.priceCents)}</span>
              </div>
              <div className="flex justify-between border-t border-white/8 pt-3 font-medium">
                <span>Balance after payment</span>
                <span className={enoughBalance ? "text-white" : "text-blush-400"}>
                  {formatPrice(Math.max(0, balanceCents - model.priceCents))}
                </span>
              </div>
            </div>

            {!enoughBalance && (
              <p className="mt-5 rounded-2xl border border-blush-500/25 bg-blush-500/10 p-4 text-sm text-blush-400">
                Not enough balance. Ask an admin for a top-up or pay by card instead.
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-5 rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || (method === "balance" && !enoughBalance)}
          className="btn-primary mt-7 w-full !py-4 text-base"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4.5 w-4.5" />}
          {busy ? "Processing" : `Pay ${formatPrice(model.priceCents)} · Talk to Her!`}
        </button>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mist-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Demo checkout — no real card is ever charged.
        </p>
      </form>

      <aside className="order-1 lg:order-2">
        <div className="card overflow-hidden">
          <div className="relative aspect-4/5">
            <Image src={model.cover} alt={model.name} fill sizes="380px" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/20 to-transparent" />
            <div className="absolute inset-x-5 bottom-5">
              <p className="font-display text-3xl text-white">
                {model.name.split(" ")[0]}, {model.age}
              </p>
              <p className="text-sm text-mist-300">{model.city}</p>
            </div>
          </div>
          <div className="space-y-3 p-6 text-sm">
            <div className="flex justify-between text-mist-300">
              <span>Private chat access</span>
              <span>{formatPrice(model.priceCents)}</span>
            </div>
            <div className="flex justify-between text-mist-300">
              <span>Service fee</span>
              <span>$0.00</span>
            </div>
            <div className="flex justify-between border-t border-white/8 pt-3 text-base font-semibold">
              <span>Total</span>
              <span>{formatPrice(model.priceCents)}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
