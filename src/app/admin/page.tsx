import Image from "next/image";
import { redirect } from "next/navigation";
import { BellOff, BellRing, CircleDollarSign, MessagesSquare, Users } from "lucide-react";

import { AdminBalance } from "@/components/admin-balance";
import { AdminOrders } from "@/components/admin-orders";
import { AdminPrices } from "@/components/admin-prices";
import { AdminTopups } from "@/components/admin-topups";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import { listModelsForAdmin, listOrders, listTopups } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin panel" };

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin") redirect("/");

  const pending = listOrders({ status: "pending" });
  const approved = listOrders({ status: "approved" }).slice(0, 8);
  const rejected = listOrders({ status: "rejected" }).slice(0, 4);
  const pendingTopups = listTopups({ status: "pending" });
  const notificationsOn = !!process.env.PUSHOVER_TOKEN && !!process.env.PUSHOVER_USER;
  const catalogModels = listModelsForAdmin();
  const freeCount = catalogModels.filter((model) => model.priceCents === 0).length;

  const revenue = (
    db.prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM orders WHERE status = 'approved'").get() as {
      total: number;
    }
  ).total;
  const memberCount = (db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'user'").get() as {
    count: number;
  }).count;
  const conversationCount = (db.prepare("SELECT COUNT(*) AS count FROM conversations").get() as { count: number })
    .count;
  const messageCount = (db.prepare("SELECT COUNT(*) AS count FROM messages").get() as { count: number }).count;

  const members = (
    db
      .prepare(
        `SELECT u.id, u.display_name AS displayName, u.email, u.balance_cents AS balanceCents,
                (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS orders
         FROM users u WHERE u.role = 'user' ORDER BY u.created_at DESC LIMIT 12`,
      )
      .all() as { id: number; displayName: string; email: string; balanceCents: number; orders: number }[]
  );

  const stats = [
    { icon: BellRing, label: "Awaiting approval", value: String(pending.length + pendingTopups.length), accent: "text-amber-300" },
    { icon: CircleDollarSign, label: "Approved revenue", value: formatPrice(revenue), accent: "text-emerald-300" },
    { icon: Users, label: "Members", value: String(memberCount), accent: "text-violet-300" },
    { icon: MessagesSquare, label: "Chats / messages", value: `${conversationCount} / ${messageCount}`, accent: "text-blush-400" },
  ];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5 pt-8 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="chip">Admin panel</span>
            <h1 className="mt-4 font-display text-5xl leading-none">Payments &amp; approvals</h1>
            <p className="mt-2 text-[15px] text-mist-500">
              Approve a payment and the member instantly gets the chat with that profile.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {notificationsOn ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
                <BellRing className="h-3.5 w-3.5" /> Push notifications on
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-mist-500"
                title="Add PUSHOVER_TOKEN and PUSHOVER_USER to .env.local and restart the app"
              >
                <BellOff className="h-3.5 w-3.5" /> Push notifications off
              </span>
            )}
            {pending.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                {pending.length} waiting
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="card p-5">
              <stat.icon className={`h-5 w-5 ${stat.accent}`} />
              <p className="mt-4 font-display text-3xl">{stat.value}</p>
              <p className="mt-1 text-[11px] tracking-[0.12em] text-mist-500 uppercase">{stat.label}</p>
            </div>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="font-display text-3xl">Pending payments</h2>
          <p className="mt-1 mb-6 text-sm text-mist-500">
            Every unlock lands here first — approving creates the private conversation. Free profiles skip this
            queue.
          </p>
          <AdminOrders orders={pending} />
        </section>

        <section className="mt-12">
          <h2 className="font-display text-3xl">Balance top-ups</h2>
          <p className="mt-1 mb-6 text-sm text-mist-500">
            Members pay by card and the money is credited only once you approve it here.
          </p>
          <AdminTopups topups={pendingTopups} />
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl">Catalog prices</h2>
              <p className="mt-1 text-sm text-mist-500">
                Set what every profile costs in the catalog, or make her free.
              </p>
            </div>
            <span className="chip">
              {catalogModels.length} profiles · {freeCount} free
            </span>
          </div>
          <div className="card mt-6 p-5 sm:p-6">
            <AdminPrices models={catalogModels} />
          </div>
        </section>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section className="card p-6 sm:p-7">
            <h2 className="font-display text-3xl">Recently approved</h2>
            <div className="mt-5 space-y-3">
              {approved.length === 0 && <p className="text-sm text-mist-500">Nothing approved yet.</p>}
              {approved.map((order) => (
                <div key={order.id} className="flex items-center gap-3.5 rounded-2xl bg-white/3 p-3">
                  {order.modelCover && (
                    <Image
                      src={order.modelCover}
                      alt={order.modelName}
                      width={44}
                      height={44}
                      className="h-11 w-11 rounded-xl object-cover object-[center_18%]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-mist-100">
                      {order.userName} → {order.modelName}
                    </p>
                    <p className="text-xs text-mist-500">
                      {order.code} · {order.decidedAt ? formatDateTime(order.decidedAt) : ""}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-emerald-300">{formatPrice(order.amountCents)}</p>
                </div>
              ))}

              {rejected.length > 0 && (
                <>
                  <p className="pt-3 text-[11px] tracking-[0.14em] text-mist-500 uppercase">Rejected</p>
                  {rejected.map((order) => (
                    <div key={order.id} className="flex items-center gap-3.5 rounded-2xl bg-white/3 p-3 opacity-70">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-mist-100">
                          {order.userName} → {order.modelName}
                        </p>
                        <p className="text-xs text-mist-500">{order.code}</p>
                      </div>
                      <p className="text-sm text-blush-400">{formatPrice(order.amountCents)}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="card p-6 sm:p-7">
            <h2 className="font-display text-3xl">Member balances</h2>
            <p className="mt-1 mb-5 text-sm text-mist-500">Top up a member so they can pay from their balance.</p>
            <AdminBalance members={members} />
          </section>
        </div>
      </main>
    </>
  );
}
