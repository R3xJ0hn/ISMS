import { Skeleton } from "@/components/ui/skeleton";

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

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-240">
            {Array.from({ length: 8 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-[0.8fr_2.4fr_repeat(9,0.8fr)] gap-4 border-b border-border px-4 py-4 last:border-b-0"
              >
                {Array.from({ length: 11 }).map((_, columnIndex) => (
                  <Skeleton
                    key={columnIndex}
                    className={columnIndex === 1 ? "h-4 w-full" : "h-4 w-16"}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
