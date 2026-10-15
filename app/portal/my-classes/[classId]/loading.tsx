import { Skeleton } from "@/components/ui/skeleton";

export default function ClassSummaryLoading() {
  return (
    <main aria-busy="true" aria-label="Loading class summary" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Skeleton className="h-9 w-44" />
      <Skeleton className="h-12 w-80 max-w-full" />
      <Skeleton className="h-60 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /></div>
    </main>
  );
}
