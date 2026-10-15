export default function ClassroomLoading() {
  return (
    <main aria-busy="true" aria-label="Loading your classes" className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-8">
      <div className="h-10 w-44 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => <div key={index} className="h-72 animate-pulse rounded-xl border bg-muted/50" />)}
      </div>
    </main>
  );
}
