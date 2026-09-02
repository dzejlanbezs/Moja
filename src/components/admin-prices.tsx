"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";

import { formatPrice } from "@/lib/format";
import type { AdminModelRow } from "@/lib/queries";

export function AdminPrices({ models }: { models: AdminModelRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(models.map((model) => [model.id, (model.priceCents / 100).toString()])),
  );
  const [saved, setSaved] = useState<Record<number, number>>(() =>
    Object.fromEntries(models.map((model) => [model.id, model.priceCents])),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? models.filter(
          (model) =>
            model.name.toLowerCase().includes(query) ||
            model.city.toLowerCase().includes(query) ||
            model.country.toLowerCase().includes(query),
        )
      : models;
    return list.slice(0, query ? 40 : 12);
  }, [models, search]);

  async function save(model: AdminModelRow) {
    const cents = Math.round(Number((prices[model.id] ?? "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError(`Enter a valid price for ${model.name}`);
      return;
    }
    setBusy(model.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/models/${model.id}/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceCents: cents }),
      });
      const data = (await response.json()) as { error?: string; priceCents?: number };
      if (!response.ok) {
        setError(data.error ?? "Could not update the price");
        return;
      }
      setSaved((current) => ({ ...current, [model.id]: cents }));
      setFlash(
        cents === 0
          ? `${model.name} is now FREE — members can open that chat instantly.`
          : `${model.name} now costs ${formatPrice(cents)}.`,
      );
      router.refresh();
    } catch {
      setError("Network error — please try again");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-mist-500" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a profile by name or city"
          className="field !rounded-full !py-2.5 !pl-11"
        />
      </div>

      {flash && (
        <p className="mb-3 rounded-2xl border border-emerald-300/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          {flash}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-2xl border border-blush-500/30 bg-blush-500/10 px-4 py-3 text-sm text-blush-400">
          {error}
        </p>
      )}

      <div className="space-y-2.5">
        {visible.map((model) => {
          const dirty = Math.round(Number((prices[model.id] ?? "0").replace(",", ".")) * 100) !== saved[model.id];
          return (
            <div
              key={model.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/3 p-3"
            >
              {model.cover && (
                <Image
                  src={model.cover}
                  alt={model.name}
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-xl object-cover object-[center_18%]"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-mist-100">{model.name}</p>
                <p className="truncate text-xs text-mist-500">
                  {model.city} · {model.unlocks} unlocked
                </p>
              </div>

              {saved[model.id] === 0 && (
                <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-300">
                  FREE
                </span>
              )}

              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-mist-500">
                    $
                  </span>
                  <input
                    value={prices[model.id] ?? ""}
                    onChange={(event) =>
                      setPrices((current) => ({
                        ...current,
                        [model.id]: event.target.value.replace(/[^\d.,]/g, ""),
                      }))
                    }
                    inputMode="decimal"
                    aria-label={`Catalog price for ${model.name}`}
                    className="field !w-24 !rounded-xl !py-2 !pl-6 text-sm"
                  />
                </div>
                <button
                  onClick={() => save(model)}
                  disabled={busy === model.id || !dirty}
                  className="btn-primary h-9 !px-4 text-xs"
                >
                  {busy === model.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-mist-500">
        Set a price to <span className="text-mist-300">0</span> to publish that profile as FREE — the catalog shows
        FREE in green and “Talk to Her!” opens the chat without waiting for your approval.
        {!search && models.length > visible.length && ` Showing ${visible.length} of ${models.length}; search for the rest.`}
      </p>
    </div>
  );
}
