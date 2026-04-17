import { Skeleton } from "@/components/Skeleton";

export default function ComparisonLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-10 h-4 w-28" />
      <Skeleton className="mt-3 h-14 w-5/6" />

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="mt-8 h-20 w-2/3" />

      <Skeleton className="mt-16 h-6 w-48" />
      <Skeleton className="mt-6 h-96" />

      <Skeleton className="mt-16 h-6 w-40" />
      <Skeleton className="mt-6 h-64" />
    </div>
  );
}
