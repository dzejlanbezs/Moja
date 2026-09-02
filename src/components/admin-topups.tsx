"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CreditCard, Loader2, X } from "lucide-react";

import { formatDateTime, formatPrice } from "@/lib/format";
import type { TopupView } from "@/lib/queries";

export function AdminTopups({ topups }: { topups: TopupView[] }) {
  const router = useRouter();
  const [list, setList] = useState(topups);
  const [busy, setBusy] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(topup: TopupView, action: "approve" | "reject") {
    setBusy(topup.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/topups/${topup.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update the top-up");
        return;
      }
      setList((current) => current.filter((item) => item.id !== topup.id));
      setFlash(
        action === "approve"
          ? `${formatPrice(topup.amountCents)} added to ${topup.userName}'s balance.`
          : `Top-up ${topup.code} was rejected.`,
      );
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(null);
    }
  }

  if (list.length === 0) {
    return (
      <p className="rounded-2xl border border-white/8 bg-white/3 p-8 text-center text-sm text-mist-500">
        {flash ?? "No balance top-ups are waiting."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {flash && (
        <p className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {flash}
        </p>
      )}
      {error && (
        <p className="rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
          {error}
        </p>
      )}

      {list.map((topup) => (
        <div
          key={topup.id}
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/8 bg-white/3 p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-xs tracking-[0.14em] text-mist-500 uppercase">{topup.code}</p>
            <p className="mt-1 truncate font-medium text-mist-100">{topup.userName}</p>
            <p className="truncate text-xs text-mist-500">
              {topup.userEmail} · {formatDateTime(topup.createdAt)} · balance {formatPrice(topup.userBalanceCents)}
            </p>
          </div>

          <span className="chip !py-1.5">
            <CreditCard className="h-3.5 w-3.5" /> {topup.cardBrand} ••{topup.cardLast4}
          </span>
          <p className="font-display text-3xl">{formatPrice(topup.amountCents)}</p>

          <div className="flex gap-2">
            <button
              onClick={() => decide(topup, "approve")}
              disabled={busy === topup.id}
              className="btn-primary !px-5 !py-2.5 text-sm"
            >
              {busy === topup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Add to balance
            </button>
            <button
              onClick={() => decide(topup, "reject")}
              disabled={busy === topup.id}
              className="btn-ghost !px-3.5 !py-2.5"
              title="Reject top-up"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
