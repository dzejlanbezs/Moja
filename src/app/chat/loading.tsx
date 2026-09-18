import { SkeletonHeader } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="mx-auto max-w-7xl px-3 pt-6 sm:px-5">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="card hidden space-y-2 p-3 lg:block">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3.5 rounded-2xl p-3">
                <div className="h-13 w-13 animate-pulse rounded-2xl bg-white/8" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-white/8" />
                  <div className="h-3 w-32 animate-pulse rounded-full bg-white/5" />
                </div>
              </div>
            ))}
          </div>
          <div className="glass-strong h-[calc(100dvh-9.5rem)] min-h-[520px] animate-pulse rounded-[28px]" />
        </div>
      </main>
    </>
  );
}
