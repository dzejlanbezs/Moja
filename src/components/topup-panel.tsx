"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react";

import { CryptoPayment, type CryptoAssetWithQr } from "@/components/crypto-payment";
import { MethodIcon, type ProviderLogos } from "@/components/method-icon";
import { cryptoFeeCents } from "@/lib/crypto-wallets";
import { formatPrice } from "@/lib/format";

const PRESETS = [25, 50, 100, 250];

type Method = "card" | "paypal" | "cashapp" | "crypto";

const METHODS: { key: Method; label: string }[] = [
  { key: "card", label: "Card" },
  { key: "paypal", label: "PayPal" },
  { key: "cashapp", label: "Cash App" },
  { key: "crypto", label: "Crypto" },
];

const METHOD_BLURB: Record<Exclude<Method, "crypto">, { title: string; body: string }> = {
  card: {
    title: "Debit or credit card",
    body: "Visa, Mastercard and Apple Pay, handled by our licensed provider.",
  },
  paypal: { title: "PayPal", body: "Pay with your PayPal balance or a linked card." },
  cashapp: { title: "Cash App", body: "Pay straight from your Cash App balance." },
};

export function TopupPanel({
  balanceCents,
  minCents,
  assets,
  logos,
}: {
  balanceCents: number;
  minCents: number;
  assets: CryptoAssetWithQr[];
  logos?: ProviderLogos;
}) {
  const [step, setStep] = useState<"amount" | "pay">("amount");
  const [method, setMethod] = useState<Method>("card");
  const [asset, setAsset] = useState<CryptoAssetWithQr>(assets[0]);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ code: string; amountCents: number; creditCents: number } | null>(null);

  const amountCents = Math.round(Number(amount.replace(",", ".")) * 100);
  const validAmount = Number.isFinite(amountCents) && amountCents >= minCents;
  const feeCents = validAmount && method === "crypto" ? cryptoFeeCents(amountCents) : 0;
  const creditCents = validAmount ? amountCents - feeCents : 0;

  function confirmAmount(event: React.FormEvent) {
    event.preventDefault();
    if (!validAmount) {
      setError(`The minimum top-up is ${formatPrice(minCents)}`);
      return;
    }
    setError(null);
    setStep("pay");
  }

  async function pay(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/topups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, method, asset: asset.id }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        creditCents?: number;
        redirectUrl?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Top-up could not be started");
        return;
      }

      // Card and PayPal continue on the provider's own page.
      if (data.redirectUrl) {
        window.location.assign(data.redirectUrl);
        return;
      }

      setDone({ code: data.code!, amountCents, creditCents: data.creditCents ?? amountCents });
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
        <h2 className="mt-6 font-display text-4xl">Transfer registered</h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-mist-300">
          Your {formatPrice(done.amountCents)} {asset.symbol} transfer{" "}
          <span className="font-medium text-white">{done.code}</span> is being confirmed. Once it lands,{" "}
          <span className="font-medium text-white">{formatPrice(done.creditCents)}</span> is credited to your
          balance after the 0.5% fee.
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
            <span className="chip">Step 2 of 2 · payment</span>
            <button
              type="button"
              onClick={() => setStep("amount")}
              className="inline-flex items-center gap-1.5 text-sm text-mist-500 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change amount
            </button>
          </div>

          <h2 className="mt-4 font-display text-3xl">Pay {formatPrice(amountCents)}</h2>
          <p className="mt-2 mb-6 text-sm text-mist-500">
            {method === "crypto"
              ? "Send the transfer from your own wallet."
              : "You are taken to our payment provider to finish the payment securely."}
          </p>

          <div className="mb-7 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5 sm:grid-cols-4">
            {METHODS.map((tab) => (
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

          {method === "crypto" ? (
            <CryptoPayment
              assets={assets}
              selected={asset}
              onSelect={setAsset}
              amountCents={amountCents}
              feeCents={feeCents}
              minCents={minCents}
            />
          ) : (
            <div className="space-y-4">
              <div className="card flex items-center gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-500/25 to-violet-500/25 ring-1 ring-white/10">
                  <MethodIcon method={method} logos={logos} size={24} className="text-blush-400" />
                </span>
                <div>
                  <p className="font-medium text-mist-100">{METHOD_BLURB[method].title}</p>
                  <p className="mt-0.5 text-sm text-mist-500">{METHOD_BLURB[method].body}</p>
                </div>
              </div>

              <div className="space-y-2.5 rounded-2xl border border-white/8 bg-white/3 p-5 text-sm">
                <div className="flex justify-between text-mist-300">
                  <span>You pay</span>
                  <span>{formatPrice(amountCents)}</span>
                </div>
                <div className="flex justify-between border-t border-white/8 pt-2.5 font-medium">
                  <span>Credited to your balance</span>
                  <span className="text-emerald-300">{formatPrice(amountCents)}</span>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-mist-500">
                You are redirected to the provider&apos;s secure page — we never see your card details. When the
                payment clears, our team credits your balance.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-5 rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary mt-7 w-full !py-4 text-base">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4.5 w-4.5" />}
            {busy
              ? "Processing"
              : method === "crypto"
                ? `I have sent ${formatPrice(amountCents)} in ${asset.symbol}`
                : `Continue to ${method === "card" ? "secure checkout" : METHOD_BLURB[method].title}`}
          </button>

          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-mist-500">
            <ShieldCheck className="h-3.5 w-3.5" />{" "}
            {method === "crypto"
              ? "Transfers are credited once they are confirmed on-chain."
              : "Payments are processed by a licensed provider."}
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
              <span className="font-medium text-emerald-300">{formatPrice(balanceCents + creditCents)}</span>
              {method === "crypto" && step === "pay" && " (after the 0.5% crypto fee)"}
            </p>
          )}
        </div>

        <div className="card space-y-4 p-6 text-sm text-mist-500">
          <p className="text-[11px] tracking-[0.14em] text-mist-500 uppercase">What balance is for</p>
          <p>Unlock chats in one tap, pay a tip request, or send a gift — all without paying again.</p>
          <p>Card, PayPal, Cash App or crypto: ETH, USDC, USDT, BTC and SOL are all accepted.</p>
          <p>Every top-up is confirmed by our team before it lands in your wallet.</p>
        </div>
      </aside>
    </div>
  );
}
