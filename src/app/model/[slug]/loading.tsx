import { SkeletonHeader, SkeletonLines } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="mx-auto max-w-7xl px-5 pt-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div>
            <div className="aspect-4/5 animate-pulse rounded-[30px] bg-white/6 sm:aspect-3/4" />
            <div className="mt-3 grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-2xl bg-white/5" />
              ))}
            </div>
          </div>
          <div className="space-y-6">
            <div className="h-6 w-56 animate-pulse rounded-full bg-white/6" />
            <div className="h-12 w-64 animate-pulse rounded-2xl bg-white/8" />
            <SkeletonLines count={4} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-3xl bg-white/5" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-[28px] bg-white/6" />
          </div>
        </div>
      </main>
    </>
  );
}
