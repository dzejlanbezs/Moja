import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";

import { formatPrice } from "@/lib/format";
import type { CatalogModel } from "@/lib/types";

export type CatalogItem = CatalogModel & { access?: "none" | "pending" | "unlocked" };

export function ModelCard({ model, priority = false }: { model: CatalogItem; priority?: boolean }) {
  return (
    <Link
      href={`/model/${model.slug}`}
      className="group relative block overflow-hidden rounded-[28px] border border-white/8 bg-ink-800/60 transition-all duration-500 hover:-translate-y-1.5 hover:border-white/16 hover:shadow-[0_30px_70px_-30px_rgba(255,61,127,0.55)]"
    >
      <div className="relative aspect-4/5 overflow-hidden">
        <Image
          src={model.cover}
          alt={model.name}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/25 to-transparent" />

        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {model.isOnline && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/12 px-2.5 py-1 text-[11px] font-medium text-emerald-300 backdrop-blur-md ring-1 ring-emerald-300/25">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Online
              </span>
            )}
            {model.access === "unlocked" && (
              <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-200 backdrop-blur-md ring-1 ring-violet-300/30">
                Unlocked
              </span>
            )}
            {model.access === "pending" && (
              <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 backdrop-blur-md ring-1 ring-amber-300/25">
                Awaiting approval
              </span>
            )}
          </div>
          {model.priceCents === 0 ? (
            <span className="rounded-full bg-emerald-400/15 px-3 py-1.5 text-sm font-bold tracking-wide text-emerald-300 backdrop-blur-md ring-1 ring-emerald-300/40">
              FREE
            </span>
          ) : (
            <span className="rounded-full bg-ink-950/60 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md ring-1 ring-white/15">
              {formatPrice(model.priceCents)}
            </span>
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-[19px] leading-tight font-semibold text-white">
                <span className="truncate">{model.name.split(" ")[0]}</span>
                <span className="text-mist-300/80">{model.age}</span>
                {model.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-300" />}
              </h3>
              <p className="mt-1 flex items-center gap-1 text-[13px] text-mist-300">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-blush-400" />
                <span className="truncate">
                  {model.city}, {model.country}
                </span>
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2.5 py-1 text-xs text-mist-100 backdrop-blur-md">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              {model.rating.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="line-clamp-1 text-[13px] text-mist-500 italic">“{model.tagline}”</p>
        <span className="shrink-0 text-xs font-medium text-blush-400 opacity-0 transition group-hover:opacity-100">
          View →
        </span>
      </div>
    </Link>
  );
}

export function ModelCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-white/8 bg-ink-800/40">
      <div className="aspect-4/5 animate-pulse bg-gradient-to-br from-white/6 to-white/2" />
      <div className="space-y-2 p-5">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/8" />
        <div className="h-3 w-1/3 animate-pulse rounded-full bg-white/6" />
      </div>
    </div>
  );
}
