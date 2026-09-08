/** Placeholder blocks shown while a page is being rendered, in the same shapes as the real content. */

export function SkeletonHeader() {
  return (
    <header className="px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="glass-strong mx-auto flex h-[66px] max-w-7xl items-center gap-4 rounded-[26px] px-4 sm:px-6">
        <div className="h-9 w-9 animate-pulse rounded-2xl bg-white/10" />
        <div className="h-3 w-24 animate-pulse rounded-full bg-white/8" />
        <div className="ml-auto h-9 w-28 animate-pulse rounded-full bg-white/8" />
      </div>
    </header>
  );
}

export function SkeletonCard() {
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

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-3 animate-pulse rounded-full bg-white/8"
          style={{ width: `${90 - index * 18}%` }}
        />
      ))}
    </div>
  );
}
