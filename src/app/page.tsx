import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CreditCard, MessageSquareHeart, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { Catalog } from "@/components/catalog";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getAccess, listModels } from "@/lib/queries";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: Sparkles,
    title: "Pick someone",
    body: "Scroll the endless catalog, open a profile and read the full story — photos, age, languages, interests.",
  },
  {
    icon: CreditCard,
    title: "Tap “Talk to Her!”",
    body: "Pay with a card or straight from your Aurea balance. One payment unlocks that conversation forever.",
  },
  {
    icon: ShieldCheck,
    title: "We approve it",
    body: "A human on our team confirms every payment, usually within minutes — no bots, no fake accounts.",
  },
  {
    icon: MessageSquareHeart,
    title: "Start talking",
    body: "The chat appears in your inbox. Send messages and photos, she answers from her own private portal.",
  },
];

export default async function HomePage() {
  const user = await getSessionUser();
  const feed = listModels({ page: 1, pageSize: 9 });
  const items =
    user?.role === "user"
      ? feed.items.map((item) => ({ ...item, access: getAccess(user.id, item.id).status }))
      : feed.items;

  const spotlight = listModels({ page: 1, pageSize: 12, sort: "rating" }).items;
  const onlineNow = listModels({ page: 1, pageSize: 1, onlineOnly: true }).total;
  const cheapest = listModels({ page: 1, pageSize: 1, sort: "price-asc" }).items[0];

  return (
    <>
      <SiteHeader />

      <main className="pb-10">
        {/* Hero ---------------------------------------------------------------- */}
        <section className="relative mx-auto max-w-7xl px-5 pt-14 pb-16 sm:pt-20 lg:pt-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="animate-rise">
              <span className="chip">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {onlineNow} companions online right now
              </span>

              <h1 className="mt-6 font-display text-[3.25rem] leading-[0.95] tracking-tight sm:text-7xl lg:text-[5.2rem]">
                Meet someone
                <br />
                <span className="text-gradient">worth talking to.</span>
              </h1>

              <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-mist-300">
                A curated catalog of {feed.total} verified companions. Browse freely, unlock the one you like from{" "}
                {!cheapest ? "$16.50" : cheapest.priceCents === 0 ? "free" : formatPrice(cheapest.priceCents)}, and
                talk privately — messages and photos, straight from her.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="#catalog" className="btn-primary !px-7 !py-3.5 text-[15px]">
                  Browse the catalog <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href={user ? "/chat" : "/register"} className="btn-ghost !px-7 !py-3.5 text-[15px]">
                  {user ? "Open my chats" : "Create free account"}
                </Link>
              </div>

              <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-white/8 pt-7">
                {[
                  { value: `${feed.total}`, label: "Verified profiles" },
                  { value: "< 5 min", label: "Average approval" },
                  { value: "100%", label: "Human replies" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="font-display text-3xl text-white">{stat.value}</dt>
                    <dd className="mt-1 text-xs tracking-wide text-mist-500 uppercase">{stat.label}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Collage */}
            <div className="relative mx-auto hidden h-[520px] w-full max-w-lg lg:block">
              {spotlight.slice(0, 3).map((model, index) => {
                const layout = [
                  "left-0 top-10 w-[58%] rotate-[-7deg] z-10",
                  "right-0 top-0 w-[52%] rotate-[6deg] z-20",
                  "left-[22%] bottom-0 w-[56%] rotate-[2deg] z-30",
                ][index];
                return (
                  <div
                    key={model.id}
                    className={`absolute ${layout} overflow-hidden rounded-[26px] border border-white/12 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] transition-transform duration-500 hover:z-40 hover:scale-[1.04] hover:rotate-0`}
                  >
                    <div className="relative aspect-4/5">
                      <Image
                        src={model.cover}
                        alt={model.name}
                        fill
                        sizes="320px"
                        priority={index === 0}
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 to-transparent" />
                      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                        <p className="text-sm font-medium text-white">
                          {model.name.split(" ")[0]}, {model.age}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] backdrop-blur ${
                            model.priceCents === 0
                              ? "bg-emerald-400/20 font-semibold text-emerald-300"
                              : "bg-white/12 text-white"
                          }`}
                        >
                          {model.priceCents === 0 ? "FREE" : formatPrice(model.priceCents)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="glass-strong absolute -bottom-16 -left-6 z-40 flex items-center gap-3 rounded-2xl px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/15">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-300" />
                </span>
                <div>
                  <p className="text-sm font-medium">Payment approved</p>
                  <p className="text-xs text-mist-500">Chat unlocked · just now</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Marquee ------------------------------------------------------------- */}
        <section className="relative overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="flex w-max animate-marquee gap-4 hover:[animation-play-state:paused]">
            {[...spotlight, ...spotlight].map((model, index) => (
              <Link
                key={`${model.id}-${index}`}
                href={`/model/${model.slug}`}
                className="group relative h-28 w-44 shrink-0 overflow-hidden rounded-2xl border border-white/8"
              >
                <Image
                  src={model.cover}
                  alt={model.name}
                  fill
                  sizes="176px"
                  className="object-cover object-[center_18%] opacity-80 transition group-hover:opacity-100"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 to-transparent" />
                <p className="absolute bottom-2 left-3 text-xs font-medium text-white">
                  {model.name.split(" ")[0]} ·{" "}
                  {model.priceCents === 0 ? (
                    <span className="font-semibold text-emerald-300">FREE</span>
                  ) : (
                    formatPrice(model.priceCents)
                  )}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works -------------------------------------------------------- */}
        <section id="how" className="mx-auto max-w-7xl scroll-mt-28 px-5 py-20">
          <div className="max-w-2xl">
            <span className="chip">How it works</span>
            <h2 className="mt-5 font-display text-4xl leading-tight sm:text-5xl">
              Four steps between you and a real conversation
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="card group relative overflow-hidden p-7 transition hover:-translate-y-1 hover:border-white/16"
              >
                <span className="absolute -top-6 -right-2 font-display text-8xl text-white/5">{index + 1}</span>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blush-500/25 to-violet-500/25 ring-1 ring-white/10">
                  <step.icon className="h-5 w-5 text-blush-400" />
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-mist-500">{step.body}</p>
              </div>
            ))}
          </div>

          <div className="card mt-6 flex flex-col items-start gap-5 p-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/20 ring-1 ring-white/10">
                <Wallet className="h-5 w-5 text-violet-300" />
              </span>
              <div>
                <p className="font-medium">Prefer not to use a card every time?</p>
                <p className="text-sm text-mist-500">Top up your Aurea balance once and unlock chats in one tap.</p>
              </div>
            </div>
            <Link href={user ? "/account" : "/register"} className="btn-soft">
              {user ? "View balance" : "Create account"} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <Catalog initial={{ items, page: feed.page, total: feed.total, hasMore: feed.hasMore }} />
      </main>

      <SiteFooter />
    </>
  );
}
