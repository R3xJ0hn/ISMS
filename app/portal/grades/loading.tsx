import { Skeleton } from "@/components/ui/skeleton";
import { GradesTableSkeleton } from "@/components/portal/grades-table-skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8" aria-label="Loading your grades">
      <div className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-9 w-40" /><Skeleton className="h-4 w-72 max-w-full" /></div>
      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-48" />
      </section>

      <GradesTableSkeleton />
    </main>
  );
}
