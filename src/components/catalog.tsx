"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";

import { ModelCard, ModelCardSkeleton, type CatalogItem } from "@/components/model-card";

type CatalogResponse = {
  items: CatalogItem[];
  page: number;
  total: number;
  hasMore: boolean;
};

const SORTS = [
  { value: "featured", label: "Featured" },
  { value: "rating", label: "Top rated" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
  { value: "newest", label: "Newest" },
] as const;

export function Catalog({ initial }: { initial: CatalogResponse }) {
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [total, setTotal] = useState(initial.total);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]["value"]>("featured");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [filtering, setFiltering] = useState(false);

  const sentinel = useRef<HTMLDivElement | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: "9", sort });
      if (query) params.set("q", query);
      if (onlineOnly) params.set("online", "1");

      const response = await fetch(`/api/models?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as CatalogResponse;

      setItems((current) => (replace ? data.items : [...current, ...data.items]));
      setPage(data.page);
      setHasMore(data.hasMore);
      setTotal(data.total);
    },
    [onlineOnly, query, sort],
  );

  // Filters changed — restart the feed from page one.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let alive = true;
    setFiltering(true);
    fetchPage(1, true)
      .catch(() => undefined)
      .finally(() => alive && setFiltering(false));
    return () => {
      alive = false;
    };
  }, [fetchPage]);

  // Infinite scroll.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || loading || filtering) return;
        setLoading(true);
        fetchPage(page + 1, false)
          .catch(() => undefined)
          .finally(() => setLoading(false));
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, filtering, hasMore, loading, page]);

  return (
    <section id="catalog" className="mx-auto w-full max-w-7xl px-5">
      <div className="flex flex-col gap-5 border-b border-white/8 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-4xl leading-none sm:text-5xl">
            The <span className="text-gradient">catalog</span>
          </h2>
          <p className="mt-3 text-[15px] text-mist-500">
            {total} verified profiles · scroll for more, it never ends
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-mist-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or city"
              className="field !w-full !rounded-full !py-2.5 !pl-11 sm:!w-64"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlineOnly((value) => !value)}
              className={`btn !px-4 !py-2.5 border ${
                onlineOnly
                  ? "border-emerald-400/40 bg-emerald-400/12 text-emerald-200"
                  : "border-white/10 bg-white/5 text-mist-300 hover:bg-white/10"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${onlineOnly ? "bg-emerald-400" : "bg-mist-500"}`} />
              Online
            </button>

            <div className="relative">
              <SlidersHorizontal className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-mist-500" />
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="field !w-auto !appearance-none !rounded-full !py-2.5 !pr-9 !pl-11"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-ink-800">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtering
          ? Array.from({ length: 6 }).map((_, index) => <ModelCardSkeleton key={index} />)
          : items.map((model, index) => (
              <div key={model.id} className="animate-rise" style={{ animationDelay: `${(index % 9) * 45}ms` }}>
                <ModelCard model={model} priority={index < 3} />
              </div>
            ))}
        {!filtering && loading && Array.from({ length: 3 }).map((_, index) => <ModelCardSkeleton key={`s${index}`} />)}
      </div>

      {!filtering && items.length === 0 && (
        <div className="card mt-10 p-14 text-center">
          <p className="font-display text-2xl">Nothing matched that search</p>
          <p className="mt-2 text-sm text-mist-500">Try a different name, city or clear the online filter.</p>
        </div>
      )}

      <div ref={sentinel} className="h-10" />

      {hasMore ? (
        <div className="flex justify-center py-8 text-sm text-mist-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading more profiles
        </div>
      ) : (
        items.length > 0 && (
          <p className="py-10 text-center text-sm text-mist-500">You have reached the end of the catalog.</p>
        )
      )}
    </section>
  );
}
