import { SkeletonCard, SkeletonHeader, SkeletonLines } from "@/components/page-skeleton";

export default function Loading() {
  return (
    <>
      <SkeletonHeader />
      <main className="mx-auto max-w-7xl px-5 pt-14">
        <div className="max-w-xl space-y-6">
          <div className="h-6 w-40 animate-pulse rounded-full bg-white/6" />
          <div className="h-14 w-full animate-pulse rounded-2xl bg-white/8" />
          <SkeletonLines />
        </div>
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </main>
    </>
  );
}
