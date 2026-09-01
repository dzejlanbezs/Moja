"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CreditCard, Loader2, Wallet, X } from "lucide-react";

import { formatDateTime, formatPrice, initials } from "@/lib/format";
import type { OrderView } from "@/lib/queries";

export function AdminOrders({ orders }: { orders: OrderView[] }) {
  const router = useRouter();
  const [list, setList] = useState(orders);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function decide(order: OrderView, action: "approve" | "reject") {
    setBusy(order.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not update the payment");
        return;
      }
      setList((current) => current.filter((item) => item.id !== order.id));
      setFlash(
        action === "approve"
          ? `${order.userName} can now chat with ${order.modelName.split(" ")[0]}.`
          : `Payment ${order.code} was rejected${order.method === "balance" ? " and refunded" : ""}.`,
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
      <div className="card p-12 text-center">
        <p className="font-display text-3xl">Inbox zero</p>
        <p className="mt-2 text-sm text-mist-500">
          {flash ?? "No payments are waiting for approval right now."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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

      {list.map((order) => (
        <div key={order.id} className="glass-strong animate-rise rounded-[26px] p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {order.modelCover && (
                <Image
                  src={order.modelCover}
                  alt={order.modelName}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="text-xs tracking-[0.14em] text-mist-500 uppercase">{order.code}</p>
                <p className="mt-1 truncate text-lg font-semibold">
                  {order.userName} → {order.modelName}
                </p>
                <p className="mt-0.5 truncate text-sm text-mist-500">
                  {order.userEmail} · {formatDateTime(order.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="chip !py-1.5">
                {order.method === "card" ? (
                  <>
                    <CreditCard className="h-3.5 w-3.5" /> {order.cardBrand} ••{order.cardLast4}
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5" /> Balance
                  </>
                )}
              </span>
              <p className="font-display text-3xl">{formatPrice(order.amountCents)}</p>
            </div>

            <div className="flex w-full gap-2 sm:w-auto">
              <button
                onClick={() => decide(order, "approve")}
                disabled={busy === order.id}
                className="btn-primary flex-1 !px-6 !py-3 sm:flex-none"
              >
                {busy === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve & open chat
              </button>
              <button
                onClick={() => decide(order, "reject")}
                disabled={busy === order.id}
                className="btn-ghost !px-4 !py-3"
                title="Reject payment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {order.method === "card" && order.cardName && (
            <p className="mt-4 border-t border-white/8 pt-4 text-xs text-mist-500">
              Card holder: <span className="text-mist-300">{order.cardName}</span> · Member balance:{" "}
              <span className="text-mist-300">{formatPrice(order.userBalanceCents)}</span> · Member ID #{order.userId}{" "}
              <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/8 text-[10px]">
                {initials(order.userName)}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
