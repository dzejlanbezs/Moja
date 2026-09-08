import { SkeletonHeader, SkeletonLines } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="mx-auto max-w-7xl px-5 pt-8">
        <div className="h-6 w-32 animate-pulse rounded-full bg-white/6" />
        <div className="mt-4 h-12 w-80 animate-pulse rounded-2xl bg-white/8" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-3xl bg-white/5" />
          ))}
        </div>
        <div className="mt-12 space-y-4">
          <div className="h-8 w-56 animate-pulse rounded-full bg-white/6" />
          <div className="h-28 animate-pulse rounded-[26px] bg-white/5" />
          <SkeletonLines count={2} />
        </div>
      </main>
    </>
  );
}
