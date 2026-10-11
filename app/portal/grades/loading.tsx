import { Skeleton } from "@/components/ui/skeleton";
import { GradesTableSkeleton } from "@/components/portal/grades-table-skeleton";

export default function Loading() {
  return (
    <main className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
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
