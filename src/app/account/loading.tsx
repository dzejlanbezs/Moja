import { SkeletonHeader, SkeletonLines } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="mx-auto max-w-7xl px-5 pt-8">
        <div className="h-6 w-28 animate-pulse rounded-full bg-white/6" />
        <div className="mt-4 h-12 w-64 animate-pulse rounded-2xl bg-white/8" />
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-[26px] bg-white/5" />
          ))}
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="card space-y-4 p-6">
            <div className="h-8 w-40 animate-pulse rounded-full bg-white/6" />
            <SkeletonLines count={3} />
          </div>
          <div className="card space-y-4 p-6">
            <div className="h-8 w-40 animate-pulse rounded-full bg-white/6" />
            <SkeletonLines count={2} />
          </div>
        </div>
      </main>
    </>
  );
}
