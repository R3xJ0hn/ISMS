import { Skeleton } from "@/components/ui/skeleton";

export function GradesTableSkeleton({ semester }: { semester?: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-4 py-3">
        {semester ? (
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {semester === "1stSem" ? "1st Semester" : "2nd Semester"}
            </h2>
            <span className="text-xs font-medium text-muted-foreground">Loading grades...</span>
          </div>
        ) : <Skeleton className="h-5 w-28" />}
      </div>
      <div className="overflow-x-auto">
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
