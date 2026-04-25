export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-4 md:p-6">
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <div className="aspect-video rounded-2xl border border-border bg-card shadow-sm" />
        <div className="aspect-video rounded-2xl border border-border bg-card shadow-sm" />
        <div className="aspect-video rounded-2xl border border-border bg-card shadow-sm" />
      </div>
      <div className="min-h-screen flex-1 rounded-3xl border border-border bg-card shadow-sm md:min-h-min" />
    </div>
  );
}
