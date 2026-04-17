import { Skeleton } from "@/components/Skeleton";

export default function CityProfileLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Skeleton className="h-4 w-64" />
      <Skeleton className="mt-10 h-4 w-28" />
      <Skeleton className="mt-3 h-14 w-3/4" />
      <Skeleton className="mt-4 h-5 w-1/2" />
      <Skeleton className="mt-8 h-28 w-72" />

      <div className="mt-12 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>

      <Skeleton className="mt-16 h-6 w-56" />
      <Skeleton className="mt-2 h-4 w-96" />
      <Skeleton className="mt-6 h-80" />

      <Skeleton className="mt-16 h-48" />
    </div>
  );
}
