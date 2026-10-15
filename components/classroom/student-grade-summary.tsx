import { BadgeCheck, BookOpen, ChevronDown, CircleAlert, Clock3, EyeOff, GraduationCap } from "lucide-react";
import type { ClassSummaryStudent } from "@/lib/classes/spreadsheet";
import { GRADE_SCALE, getGradeEquivalent } from "@/lib/grade-equivalence";
import { cn } from "@/lib/utils";
import { getClassPeriodVisibility, classPeriodDefinitions, type ClassPeriodVisibility } from "@/lib/classes/period-visibility";

const resultThemes = {
  passed: {
    card: "border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30",
    icon: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    value: "text-blue-950 dark:text-blue-100",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
    label: "Passed",
    Icon: BadgeCheck,
  },
  failed: {
    card: "border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30",
    icon: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    value: "text-red-950 dark:text-red-100",
    badge: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
    label: "Failed",
    Icon: CircleAlert,
  },
  incomplete: {
    card: "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30",
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    value: "text-amber-950 dark:text-amber-100",
    badge: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
    label: "Incomplete",
    Icon: Clock3,
  },
  unavailable: {
    card: "border bg-muted/25",
    icon: "bg-muted text-muted-foreground",
    value: "text-foreground",
    badge: "border bg-background text-muted-foreground",
    label: "Not available",
    Icon: Clock3,
  },
} as const;

export function StudentGradeSummary({ record, visibility }: { record: ClassSummaryStudent; visibility?: ClassPeriodVisibility }) {
  const periods = getClassPeriodVisibility(visibility);
  const allVisible = classPeriodDefinitions.every(({ field }) => periods[field]);
  const result = getGradeEquivalent(allVisible ? record.average : null, allVisible ? record.remarks : null);
  const theme = resultThemes[result.status];
  const StatusIcon = theme.Icon;
  const averageText = result.average !== null ? String(result.average) : allVisible ? record.average?.trim() || "—" : "—";
  const showRounding = (result.status === "passed" || result.status === "failed") &&
    result.average !== null && result.roundedAverage !== result.average;

  return (
    <div className="space-y-6">
      {allVisible ? <section aria-label="Final grade result" className={cn("min-w-0 rounded-2xl border p-5 sm:p-6", theme.card)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", theme.icon)}><GraduationCap aria-hidden="true" className="size-5" /></span>
            <h3 className="text-sm font-semibold">Your final result</h3>
          </div>
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold", theme.badge)}><StatusIcon aria-hidden="true" className="size-3.5" />{theme.label}</span>
        </div>
        <dl className="mt-6 grid min-w-0 gap-5 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] sm:items-center sm:gap-8">
          <div className="min-w-0">
            <dt className="text-sm font-medium text-muted-foreground">Final average</dt>
            <dd className={cn("mt-2 flex min-w-0 items-baseline gap-1.5 text-5xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-6xl", theme.value)}><span className="min-w-0">{averageText}</span>{result.average !== null && <span className="text-2xl font-medium">%</span>}</dd>
            {showRounding ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Rounded to {result.roundedAverage}% for the grade equivalent.</p> : result.status === "unavailable" ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Your equivalent will appear when a valid final average is available.</p> : result.status === "incomplete" ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Your grade is marked incomplete.</p> : null}
          </div>
          <div className="min-w-0 rounded-xl border border-black/5 bg-background/80 p-5 dark:border-white/10">
            <dt className="text-sm font-medium text-muted-foreground">Grade equivalent</dt>
            <dd className={cn("mt-2 text-4xl font-semibold tracking-tight sm:text-5xl", theme.value)}>{result.equivalent ?? "—"}</dd>
            {result.description && <p className="mt-2 text-sm font-medium">{result.description}</p>}
          </div>
        </dl>
      </section> : (
        <section aria-label="Final result not released" className="flex min-w-0 items-start gap-3 rounded-xl border bg-muted/25 p-5">
          <EyeOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Final result not released</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Your final average and grade equivalent will be available when your teacher releases all grading periods.</p>
          </div>
        </section>
      )}

      <section aria-labelledby="grading-periods-heading" className="min-w-0">
        <h3 id="grading-periods-heading" className="mb-3 text-sm font-semibold">Grading periods</h3>
        <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Prelim", value: record.prelim, visible: periods.prelimVisible },
            { label: "Midterm", value: record.midterm, visible: periods.midtermVisible },
            { label: "Prefinals", value: record.prefinals, visible: periods.prefinalsVisible },
            { label: "Finals", value: record.finals, visible: periods.finalsVisible },
          ].map(({ label, value, visible }) => (
            <div key={label} className="min-w-0 rounded-xl border bg-card px-4 py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("mt-1.5 font-semibold [overflow-wrap:anywhere]", visible && value !== null ? "text-xl" : "text-sm text-muted-foreground")}>{visible ? value ?? "Not posted" : "Hidden by your teacher"}</dd></div>
          ))}
        </dl>
      </section>

      {allVisible && <dl className="grid min-w-0 gap-5 rounded-xl border bg-card p-5 text-sm sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-muted-foreground">Remarks</dt><dd className="mt-1.5 whitespace-pre-wrap font-medium [overflow-wrap:anywhere]">{record.remarks ?? "—"}</dd></div>
        <div className="min-w-0"><dt className="text-muted-foreground">Note</dt><dd className="mt-1.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{record.note ?? "—"}</dd></div>
      </dl>}

      <details className="group min-w-0 overflow-hidden rounded-xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring [&::-webkit-details-marker]:hidden"><BookOpen aria-hidden="true" className="size-4 text-muted-foreground" /><span>Grading scale</span><ChevronDown aria-hidden="true" className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary>
        <div className="overflow-x-auto border-t" role="region" aria-label="Grading scale reference" tabIndex={0}>
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="px-5 py-3 text-left text-xs leading-5 text-muted-foreground">Final averages are rounded to the nearest whole percent before conversion.</caption>
            <thead className="bg-muted/30 text-muted-foreground"><tr><th scope="col" className="px-2 py-2.5 font-medium sm:px-5">Equivalent</th><th scope="col" className="px-2 py-2.5 font-medium sm:px-5">Average</th><th scope="col" className="px-2 py-2.5 font-medium sm:px-5">Description</th></tr></thead>
            <tbody className="divide-y">
              {GRADE_SCALE.map((grade) => <tr key={grade.equivalent} className={grade.equivalent === result.equivalent ? "bg-primary/5" : undefined}><th scope="row" className="px-2 py-2.5 font-medium sm:px-5">{grade.equivalent}</th><td className="px-2 py-2.5 sm:px-5">{grade.range}</td><td className="px-2 py-2.5 sm:px-5">{grade.description ?? "—"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
