import { Skeleton } from "@/components/Skeleton";

export default function RootLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-6 h-12 w-3/4" />
      <Skeleton className="mt-3 h-5 w-1/2" />
      <div className="mt-10 grid gap-4 grid-cols-2 md:grid-cols-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="mt-10 h-64" />
    </div>
  );
}
