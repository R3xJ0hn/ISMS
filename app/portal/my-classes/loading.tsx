import { Skeleton } from "@/components/ui/skeleton";

export default function MyClassesLoading() {
  return (
    <main aria-busy="true" aria-label="Loading your classes" className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <div className="space-y-3"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-96 max-w-full" /></div>
      <div className="flex flex-wrap gap-3"><Skeleton className="h-10 w-full sm:w-80" /><Skeleton className="h-10 w-44" /></div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((card) => <Skeleton key={card} className="h-80 rounded-2xl" />)}
      </div>
    </main>
  );
}
