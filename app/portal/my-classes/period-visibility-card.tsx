"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { usePortalToast } from "@/components/portal/toasts";
import { classPeriodDefinitions, type ClassPeriodName, type ClassPeriodVisibility } from "@/lib/classes/period-visibility";
import { cn } from "@/lib/utils";
import { saveClassPeriodVisibilityAction } from "./actions";

export function PeriodVisibilityCard({ classId, visibility: savedVisibility }: {
  classId: string;
  visibility: ClassPeriodVisibility;
}) {
  const router = useRouter();
  const notify = usePortalToast();
  const headingId = useId();
  const descriptionId = `${headingId}-description`;
  const savedVersion = classPeriodDefinitions.map(({ field }) => String(savedVisibility[field])).join(":");
  const [previousSavedVersion, setPreviousSavedVersion] = useState(savedVersion);
  const [visibility, setVisibility] = useState(savedVisibility);
  const [pendingPeriod, setPendingPeriod] = useState<ClassPeriodName | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  // Sync refreshed settings while preserving focus on the switch being used.
  if (previousSavedVersion !== savedVersion) {
    setPreviousSavedVersion(savedVersion);
    setVisibility(savedVisibility);
  }

  async function changeVisibility(period: ClassPeriodName, field: keyof ClassPeriodVisibility) {
    if (busy.current) return;
    busy.current = true;
    const previous = visibility[field];
    const next = !previous;
    setError("");
    setPendingPeriod(period);
    setVisibility((current) => ({ ...current, [field]: next }));

    const formData = new FormData();
    formData.set("classId", classId);
    formData.set("period", period);
    formData.set("visible", String(next));

    try {
      const result = await saveClassPeriodVisibilityAction({ success: false, message: "" }, formData);
      if (!result.success) {
        setVisibility((current) => ({ ...current, [field]: previous }));
        const message = result.message || "Unable to update student record visibility. Please try again.";
        setError(message);
        notify(message, "error");
        return;
      }
      setVisibility((current) => ({ ...current, [field]: result.visible ?? next }));
      notify(result.message || `${period} records are now ${next ? "visible to" : "hidden from"} students.`, "success");
      router.refresh();
    } catch {
      setVisibility((current) => ({ ...current, [field]: previous }));
      const message = "Unable to update student record visibility. Please try again.";
      setError(message);
      notify(message, "error");
    } finally {
      busy.current = false;
      setPendingPeriod(null);
    }
  }

  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Eye aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 id={headingId} className="font-semibold">Student record visibility</h2>
          <p id={descriptionId} className="mt-1 text-sm leading-6 text-muted-foreground">Choose which grading periods students can view in Grades and Classwork. You can still view every period.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {classPeriodDefinitions.map(({ period, label, field }) => {
          const visible = visibility[field];
          const saving = pendingPeriod === period;
          const labelId = `${headingId}-${period}-label`;
          const statusId = `${headingId}-${period}-status`;
          const StatusIcon = visible ? Eye : EyeOff;
          return (
            <div key={period} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
              <div className="min-w-0">
                <h3 id={labelId} className="text-sm font-semibold">{label}</h3>
                <p id={statusId} className={cn("mt-1 flex items-center gap-1.5 text-xs", visible ? "text-emerald-700" : "text-muted-foreground")}>
                  {saving ? <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" /> : <StatusIcon aria-hidden="true" className="size-3.5" />}
                  {saving ? "Saving..." : visible ? "Visible to students" : "Hidden from students"}
                </p>
              </div>
              <button type="button" role="switch" aria-checked={visible} aria-labelledby={labelId} aria-describedby={`${statusId} ${descriptionId}`} aria-disabled={pendingPeriod !== null}
                onClick={() => { void changeVisibility(period, field); }}
                className="flex min-h-11 min-w-14 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-disabled:cursor-wait aria-disabled:opacity-60">
                <span aria-hidden="true" className={cn("flex h-6 w-11 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none", visible ? "bg-primary" : "bg-muted-foreground/40")}>
                  <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none", visible ? "translate-x-5" : "translate-x-0")} />
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">The final average and equivalent appear only when all four grading periods are visible.</p>
      <span role="status" className="sr-only">{pendingPeriod ? `Saving ${pendingPeriod} record visibility.` : ""}</span>
      {error && <p role="alert" className="mt-3 text-sm leading-6 text-destructive">{error}</p>}
    </section>
  );
}
