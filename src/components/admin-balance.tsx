"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

import { formatPrice } from "@/lib/format";

type Member = { id: number; displayName: string; email: string; balanceCents: number; orders: number };

export function AdminBalance({ members }: { members: Member[] }) {
  const router = useRouter();
  const [balances, setBalances] = useState(() =>
    Object.fromEntries(members.map((member) => [member.id, member.balanceCents])),
  );
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function topUp(memberId: number, dollars: number) {
    setBusy(memberId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/members/${memberId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(dollars * 100) }),
      });
      const data = (await response.json()) as { error?: string; balanceCents?: number };
      if (!response.ok) {
        setError(data.error ?? "Could not update the balance");
        return;
      }
      setBalances((current) => ({ ...current, [memberId]: data.balanceCents! }));
      setAmounts((current) => ({ ...current, [memberId]: "" }));
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
          {error}
        </p>
      )}

      {members.map((member) => (
        <div
          key={member.id}
          className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/8 bg-white/3 p-4"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-mist-100">{member.displayName}</p>
            <p className="truncate text-xs text-mist-500">
              {member.email} · {member.orders} payments
            </p>
          </div>

          <p className="font-display text-2xl">{formatPrice(balances[member.id] ?? 0)}</p>

          <div className="flex items-center gap-2">
            {[25, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => topUp(member.id, preset)}
                disabled={busy === member.id}
                className="btn-soft !px-3.5 !py-2 text-xs"
              >
                +${preset}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                value={amounts[member.id] ?? ""}
                onChange={(event) =>
                  setAmounts((current) => ({ ...current, [member.id]: event.target.value }))
                }
                inputMode="decimal"
                placeholder="0.00"
                className="field !w-24 !rounded-xl !py-2 text-sm"
              />
              <button
                onClick={() => topUp(member.id, Number(amounts[member.id] ?? 0))}
                disabled={busy === member.id || !Number(amounts[member.id])}
                className="btn-primary h-9 w-9 !px-0"
                aria-label="Add amount"
              >
                {busy === member.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
