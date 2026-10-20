import { Skeleton } from "@/components/ui/skeleton";

/** A poster, a title and a ticket box: close enough to the event and home layouts that nothing jumps. */
export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]" aria-busy="true" aria-label="Loading">
      <div className="space-y-4">
        <Skeleton className="aspect-video w-full rounded-3xl" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <Skeleton className="h-72 w-full rounded-3xl" />
    </div>
  );
}
