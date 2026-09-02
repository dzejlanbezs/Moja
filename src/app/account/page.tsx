import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, CreditCard, MessageCircle, Plus, Wallet } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { listConversationsForUser, listOrders, listTopups } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account" };

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-300/25 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
  rejected: "border-blush-500/25 bg-blush-500/10 text-blush-400",
};

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/account");
  if (user.role !== "user") redirect("/");

  const orders = listOrders({ userId: user.id });
  const topups = listTopups({ userId: user.id });
  const conversations = listConversationsForUser(user.id);
  const transactions = db
    .prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 12")
    .all(user.id) as { id: number; amount_cents: number; kind: string; note: string; created_at: number }[];

  const spent = orders
    .filter((order) => order.status !== "rejected")
    .reduce((total, order) => total + order.amountCents, 0);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5 pt-8 pb-16">
        <span className="chip">Account</span>
        <h1 className="mt-4 font-display text-5xl leading-none">Hi, {user.displayName.split(" ")[0]}</h1>
        <p className="mt-2 text-[15px] text-mist-500">{user.email}</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <div className="glass-strong rounded-[26px] p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-white/10">
              <Wallet className="h-5 w-5 text-violet-300" />
            </span>
            <p className="mt-5 text-xs tracking-[0.14em] text-mist-500 uppercase">Balance</p>
            <p className="mt-1 font-display text-4xl">{formatPrice(user.balanceCents)}</p>
            <Link href="/topup" className="btn-primary mt-4 !px-5 !py-2.5 text-sm">
              <Plus className="h-4 w-4" /> Top up balance
            </Link>
          </div>

          <div className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blush-500/15 ring-1 ring-white/10">
              <CreditCard className="h-5 w-5 text-blush-400" />
            </span>
            <p className="mt-5 text-xs tracking-[0.14em] text-mist-500 uppercase">Total spent</p>
            <p className="mt-1 font-display text-4xl">{formatPrice(spent)}</p>
            <p className="mt-2 text-xs text-mist-500">{orders.length} payments</p>
          </div>

          <div className="card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 ring-1 ring-white/10">
              <MessageCircle className="h-5 w-5 text-emerald-300" />
            </span>
            <p className="mt-5 text-xs tracking-[0.14em] text-mist-500 uppercase">Unlocked chats</p>
            <p className="mt-1 font-display text-4xl">{conversations.length}</p>
            <Link href="/chat" className="mt-2 inline-block text-xs text-blush-400 hover:text-blush-500">
              Open my inbox →
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <section className="card p-6 sm:p-7">
            <h2 className="font-display text-3xl">Payments</h2>
            <p className="mt-1 text-sm text-mist-500">Every unlock is reviewed by our team before the chat opens.</p>

            <div className="mt-6 space-y-3">
              {orders.length === 0 && (
                <p className="rounded-2xl border border-white/8 bg-white/3 p-8 text-center text-sm text-mist-500">
                  No payments yet.{" "}
                  <Link href="/#catalog" className="text-blush-400">
                    Find someone to talk to
                  </Link>
                </p>
              )}

              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/8 bg-white/3 p-3.5"
                >
                  {order.modelCover && (
                    <Image
                      src={order.modelCover}
                      alt={order.modelName}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-2xl object-cover object-[center_18%]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-mist-100">{order.modelName}</p>
                    <p className="text-xs text-mist-500">
                      {order.code} · {formatDateTime(order.createdAt)} ·{" "}
                      {order.method === "free"
                        ? "Free profile"
                        : order.method === "card"
                          ? `${order.cardBrand} ••${order.cardLast4}`
                          : "Aurea balance"}
                    </p>
                  </div>
                  <p className="font-medium">{formatPrice(order.amountCents)}</p>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                      STATUS_STYLE[order.status]
                    }`}
                  >
                    {order.status === "pending" ? "Awaiting approval" : order.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="card p-6 sm:p-7">
            {topups.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-3xl">Top-ups</h2>
                <div className="mt-5 space-y-3">
                  {topups.slice(0, 5).map((topup) => (
                    <div
                      key={topup.id}
                      className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-mist-100">{formatPrice(topup.amountCents)}</p>
                        <p className="truncate text-xs text-mist-500">
                          {topup.code} · {formatDateTime(topup.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                          STATUS_STYLE[topup.status]
                        }`}
                      >
                        {topup.status === "pending" ? "Awaiting approval" : topup.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="font-display text-3xl">Wallet activity</h2>
            <div className="mt-6 space-y-4">
              {transactions.length === 0 && <p className="text-sm text-mist-500">No wallet activity yet.</p>}
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-start gap-3">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/6">
                    <Clock className="h-3.5 w-3.5 text-mist-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-mist-100">{transaction.note}</p>
                    <p className="text-xs text-mist-500">{formatDateTime(transaction.created_at)}</p>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      transaction.amount_cents >= 0 ? "text-emerald-300" : "text-mist-300"
                    }`}
                  >
                    {transaction.amount_cents >= 0 ? "+" : "−"}
                    {formatPrice(Math.abs(transaction.amount_cents))}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
