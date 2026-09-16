"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";

import { MethodIcon, type ProviderLogos } from "@/components/method-icon";
import { formatPrice } from "@/lib/format";

type Props = {
  model: { slug: string; name: string; cover: string; priceCents: number; city: string; age: number };
  balanceCents: number;
  logos?: ProviderLogos;
};

type Method = "balance" | "card" | "paypal" | "cashapp";

const METHOD_BLURB: Record<Exclude<Method, "balance">, { title: string; body: string }> = {
  card: {
    title: "Debit or credit card",
    body: "Visa, Mastercard and Apple Pay, handled by our licensed provider.",
  },
  paypal: { title: "PayPal", body: "Pay with your PayPal balance or a linked card." },
  cashapp: { title: "Cash App", body: "Pay straight from your Cash App balance." },
};

export function PaymentPanel({ model, balanceCents, logos }: Props) {
  const [method, setMethod] = useState<Method>(balanceCents >= model.priceCents ? "balance" : "card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enoughBalance = balanceCents >= model.priceCents;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: model.slug, method }),
      });
      const data = (await response.json()) as { error?: string; redirectUrl?: string };
      if (!response.ok) {
        setError(data.error ?? "Payment could not be started");
        return;
      }

      // Card and PayPal finish on the provider's page; balance is settled here.
      window.location.assign(data.redirectUrl ?? "/account");
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <form onSubmit={submit} className="glass-strong order-2 rounded-[30px] p-6 sm:p-8 lg:order-1">
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5 sm:grid-cols-4">
          {(
            [
              { key: "balance", label: "Balance" },
              { key: "card", label: "Card" },
              { key: "paypal", label: "PayPal" },
              { key: "cashapp", label: "Cash App" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setMethod(tab.key);
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-sm font-medium transition ${
                method === tab.key ? "bg-white/12 text-white shadow-lg" : "text-mist-500 hover:text-mist-100"
              }`}
            >
              <MethodIcon method={tab.key} logos={logos} size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {method === "balance" ? (
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
                Not enough balance.{" "}
                <Link href="/topup" className="underline underline-offset-4">
                  Top up
                </Link>{" "}
                or pay by card instead.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-7 space-y-4">
            <div className="card flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-500/25 to-violet-500/25 ring-1 ring-white/10">
                <MethodIcon method={method} logos={logos} size={24} className="text-blush-400" />
              </span>
              <div>
                <p className="font-medium text-mist-100">{METHOD_BLURB[method].title}</p>
                <p className="mt-0.5 text-sm text-mist-500">{METHOD_BLURB[method].body}</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-mist-500">
              You are redirected to the provider&apos;s secure page — we never see your card details. As soon as
              the payment clears, our team opens the chat.
            </p>
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
          {busy
            ? "Processing"
            : method === "balance"
              ? `Pay ${formatPrice(model.priceCents)} from balance`
              : `Continue to ${method === "card" ? "secure checkout" : METHOD_BLURB[method].title}`}
        </button>

        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mist-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Payments are processed by a licensed provider.
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
