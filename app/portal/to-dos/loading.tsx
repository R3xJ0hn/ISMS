import { Skeleton } from "@/components/ui/skeleton";

export default function TodosLoading() {
  return (
    <main aria-busy="true" aria-label="Loading your to-dos" className="mx-auto w-full min-w-0 max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2"><Skeleton className="h-8 w-32" /><Skeleton className="h-4 w-64 max-w-full" /></div>
      {[0, 1].map((index) => <div key={index} className="overflow-hidden rounded-2xl border bg-card">
        <div className="space-y-2 border-b bg-muted/30 p-4 sm:px-5"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-3 w-2/3" /></div>
        <div className="divide-y">{[0, 1, 2].map((activity) => <div key={activity} className="flex items-center gap-3 p-4 sm:px-5">
          <Skeleton className="size-9 shrink-0 rounded-xl" /><div className="min-w-0 flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
        </div>)}</div>
      </div>)}
    </main>
  );
}
