import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Clock,
  Languages,
  MapPin,
  MessageCircle,
  Ruler,
  Sparkles,
  Star,
} from "lucide-react";

import { FreeUnlockButton } from "@/components/free-unlock-button";
import { ModelCard } from "@/components/model-card";
import { Gallery } from "@/components/gallery";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSessionUser } from "@/lib/auth";
import { formatPrice } from "@/lib/format";
import { getAccess, getModelBySlug, similarModels } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = getModelBySlug(slug);
  return { title: model ? `${model.name}, ${model.age} — ${model.city}` : "Profile" };
}

export default async function ModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = getModelBySlug(slug);
  if (!model) notFound();

  const user = await getSessionUser();
  const access = user?.role === "user" ? getAccess(user.id, model.id) : { status: "none" as const };
  const similar = similarModels(model);

  const facts = [
    { icon: Ruler, label: "Height", value: `${model.heightCm} cm` },
    { icon: Sparkles, label: "Zodiac", value: model.zodiac },
    { icon: Clock, label: "Replies", value: model.responseTime },
    { icon: Languages, label: "Speaks", value: model.languages.join(", ") },
  ];

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-5 pt-10 pb-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-mist-500 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to catalog
        </Link>

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="animate-rise lg:sticky lg:top-28 lg:self-start">
            <Gallery photos={model.photos} name={model.name} />
          </div>

          <div className="animate-rise [animation-delay:80ms]">
            <div className="flex flex-wrap items-center gap-2">
              {model.isOnline ? (
                <span className="chip !text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Online now
                </span>
              ) : (
                <span className="chip">Usually replies {model.responseTime}</span>
              )}
              {model.isVerified && (
                <span className="chip !text-sky-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> ID verified
                </span>
              )}
              <span className="chip">
                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                {model.rating.toFixed(1)} · {model.reviewsCount} reviews
              </span>
            </div>

            <h1 className="mt-5 font-display text-5xl leading-none sm:text-6xl">
              {model.name.split(" ")[0]}
              <span className="text-mist-500">, {model.age}</span>
            </h1>

            <p className="mt-3 flex items-center gap-1.5 text-mist-300">
              <MapPin className="h-4 w-4 text-blush-400" />
              {model.city}, {model.country}
            </p>

            <p className="mt-6 font-display text-2xl leading-snug text-mist-100 italic">“{model.tagline}”</p>
            <p className="mt-4 text-[15px] leading-relaxed text-mist-300">{model.bio}</p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map((fact) => (
                <div key={fact.label} className="card p-4">
                  <fact.icon className="h-4 w-4 text-blush-400" />
                  <p className="mt-3 text-[11px] tracking-[0.12em] text-mist-500 uppercase">{fact.label}</p>
                  <p className="mt-1 text-sm text-mist-100">{fact.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="text-[11px] tracking-[0.14em] text-mist-500 uppercase">Into</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {model.interests.map((interest) => (
                  <span key={interest} className="chip !px-3.5 !py-1.5 !text-mist-100">
                    {interest}
                  </span>
                ))}
                <span className="chip !px-3.5 !py-1.5">{model.hair} hair</span>
                <span className="chip !px-3.5 !py-1.5">{model.eyes} eyes</span>
              </div>
            </div>

            {/* Unlock panel */}
            <div className="glass-strong mt-9 rounded-[28px] p-6 sm:p-7">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs tracking-[0.14em] text-mist-500 uppercase">Private chat access</p>
                  {model.priceCents === 0 ? (
                    <>
                      <p className="mt-2 font-display text-4xl text-emerald-300">FREE</p>
                      <p className="mt-1 text-sm text-mist-500">No payment needed · unlimited messages & photos</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 font-display text-4xl text-white">{formatPrice(model.priceCents)}</p>
                      <p className="mt-1 text-sm text-mist-500">One-time payment · unlimited messages & photos</p>
                    </>
                  )}
                </div>

                {access.status === "unlocked" && access.conversationId ? (
                  <Link href={`/chat/${access.conversationId}`} className="btn-primary !px-8 !py-4 text-base">
                    <MessageCircle className="h-5 w-5" /> Open your chat
                  </Link>
                ) : access.status === "pending" ? (
                  <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-5 py-4 text-sm text-amber-100">
                    Payment <span className="font-medium">{access.orderCode}</span> is waiting for approval.
                    <Link href="/account" className="ml-1 underline underline-offset-4">
                      Track it
                    </Link>
                  </div>
                ) : model.priceCents === 0 && user?.role === "user" ? (
                  <FreeUnlockButton slug={model.slug} name={model.name} />
                ) : (
                  <Link
                    href={
                      user
                        ? `/unlock/${model.slug}`
                        : `/login?next=${model.priceCents === 0 ? `/model/${model.slug}` : `/unlock/${model.slug}`}`
                    }
                    className="btn-primary !px-9 !py-4 text-base"
                  >
                    Talk to Her! <MessageCircle className="h-5 w-5" />
                  </Link>
                )}
              </div>

              <div className="mt-6 grid gap-3 border-t border-white/8 pt-5 text-xs text-mist-500 sm:grid-cols-3">
                {model.priceCents === 0 ? (
                  <>
                    <p>✓ Free profile</p>
                    <p>✓ Chat opens instantly</p>
                    <p>✓ Photos and messages both ways</p>
                  </>
                ) : (
                  <>
                    <p>✓ Card or Aurea balance</p>
                    <p>✓ Manually approved by our team</p>
                    <p>✓ Photos and messages both ways</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-24">
            <div className="flex items-end justify-between border-b border-white/8 pb-5">
              <h2 className="font-display text-3xl sm:text-4xl">You may also like</h2>
              <Link href="/#catalog" className="text-sm text-mist-500 hover:text-white">
                See all →
              </Link>
            </div>
            <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => (
                <ModelCard key={item.id} model={item} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
