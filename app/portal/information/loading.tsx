import { Skeleton } from "@/components/ui/skeleton";

export default function InformationLoading() {
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="Loading your information">
      <div className="space-y-3"><Skeleton className="h-9 w-48" /><Skeleton className="h-4 w-72 max-w-full" /></div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-5 lg:grid-cols-2">{[0, 1, 2, 3].map((section) => <Skeleton key={section} className="h-72 rounded-2xl" />)}</div>
    </main>
  );
}
