import { Skeleton } from "@/components/ui/skeleton";

export function GradesTableSkeleton({ semester }: { semester?: string }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card" aria-label="Loading grade records">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        {semester ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {semester === "unassigned" ? "Semester not assigned" : semester === "1stSem" ? "1st Semester" : "2nd Semester"}
            </h2>
            <span className="text-xs font-medium text-muted-foreground">Loading grades...</span>
          </div>
        ) : <Skeleton className="h-5 w-28" />}
      </div>
      <div className="divide-y divide-border lg:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="space-y-4 p-4 sm:p-6">
            <div className="space-y-2"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
            <div className="space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-2/3" /></div>
            <div className="divide-y divide-border/50">{Array.from({ length: 4 }, (_, period) => (
              <div key={period} className="flex items-center justify-between py-2"><Skeleton className="h-4 w-16" /><Skeleton className="h-4 w-8" /></div>
            ))}</div>
            <div className="flex items-center justify-between border-t pt-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-12" /></div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-240">
          {semester ? (
            <div className="grid grid-cols-[0.8fr_2.4fr_repeat(9,0.8fr)] gap-4 border-b border-border bg-muted/50 px-4 py-3">
              {Array.from({ length: 11 }, (_, index) => <Skeleton key={index} className="h-4 w-full" />)}
            </div>
          ) : null}
          {Array.from({ length: semester ? 7 : 8 }, (_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-[0.8fr_2.4fr_repeat(9,0.8fr)] gap-4 border-b border-border px-4 py-4 last:border-b-0">
              {Array.from({ length: 11 }, (_, columnIndex) => (
                <Skeleton key={columnIndex} className={columnIndex === 1 ? "h-4 w-full" : "h-4 w-16"} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
