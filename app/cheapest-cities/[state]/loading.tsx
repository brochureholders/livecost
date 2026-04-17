import { Skeleton } from "@/components/Skeleton";

export default function RankingLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-10 h-4 w-32" />
      <Skeleton className="mt-3 h-14 w-3/4" />
      <Skeleton className="mt-4 h-5 w-1/2" />

      <div className="mt-8 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>

      <Skeleton className="mt-12 h-6 w-60" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-[480px]" />
    </div>
  );
}
