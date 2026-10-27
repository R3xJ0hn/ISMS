import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PortalTable } from "@/components/portal/data-table";
import { getVisiblePeriodGrades } from "@/lib/classes/period-visibility";
import type { StudentClassGrade } from "@/lib/classes/student-grades";

const gradingPeriods = [
  ["Prelim", "prelim", "prelimVisible"],
  ["Midterm", "midterm", "midtermVisible"],
  ["Prefinals", "prefinals", "prefinalsVisible"],
  ["Finals", "finals", "finalsVisible"],
] as const;

function averageValue(grade: StudentClassGrade) {
  return Object.values(grade.periodVisibility).every(Boolean) ? grade.average ?? "-" : "Hidden";
}

function GradeSubject({ grade }: { grade: StudentClassGrade }) {
  return (
    <div className="min-w-0">
      <Link href={`/portal/classroom/${grade.classId}?tab=grades`}
        className="group -mx-2 -my-1.5 flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 text-foreground transition-colors hover:border-border/70 hover:bg-muted/60 focus-visible:border-border focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
        aria-label={`View grades for ${grade.subject}, ${grade.classCode}`}>
        <div className="min-w-0 flex-1">
          <h3 className="wrap-anywhere text-sm font-semibold leading-5 text-violet-800 dark:text-violet-300">{grade.subject}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-medium tabular-nums">{grade.classCode}</span>
            <span className="min-w-0 wrap-anywhere">{grade.sectionName}</span>
          </div>
        </div>
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground group-focus-visible:bg-background group-focus-visible:text-foreground motion-reduce:transition-none">
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
        </span>
      </Link>
      {grade.message && <p className={`mt-3 wrap-anywhere text-xs leading-5 ${grade.availability === "hidden" ? "text-muted-foreground" : "text-red-700"}`}>{grade.message}</p>}
    </div>
  );
}

export function StudentGradesTable({ grades }: { grades: readonly StudentClassGrade[] }) {
  const rows = grades.map((grade) => ({ ...grade, ...getVisiblePeriodGrades(grade, grade.periodVisibility) }));
  return (
    <>
      <div className="divide-y divide-border lg:hidden" role="region" aria-label="Subject grade cards">
        {rows.map((grade) => (
          <article key={grade.classId} className="min-w-0 p-4 sm:p-6" aria-label={`${grade.subject} grades`}>
            <GradeSubject grade={grade} />
            <dl className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 text-[13px] leading-5">
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2"><dt className="text-xs text-muted-foreground">Subject code</dt><dd className="wrap-anywhere font-medium">{grade.code ?? "-"}</dd></div>
              <div className="flex items-baseline gap-2"><dt className="text-xs text-muted-foreground">Units</dt><dd className="font-medium">{grade.units ?? "-"}</dd></div>
              <div className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2"><dt className="text-xs text-muted-foreground">Instructor</dt><dd className="wrap-anywhere">{grade.instructorName || "Not assigned"}</dd></div>
            </dl>
            <dl className="mt-3 min-w-0 divide-y divide-border/50">
              {gradingPeriods.map(([label, field, visibility]) => (
                <div key={field} className="flex min-w-0 items-baseline justify-between gap-4 py-2">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 wrap-anywhere text-right text-base font-medium tabular-nums">{grade.periodVisibility[visibility] ? grade[field] ?? "-" : "Hidden"}</dd>
                </div>
              ))}
            </dl>
            <dl className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border py-3">
              <dt className="text-sm font-semibold">Final average</dt>
              <dd className={`min-w-0 wrap-anywhere font-semibold tabular-nums ${averageValue(grade) === "Hidden" ? "text-sm text-muted-foreground" : "text-2xl tracking-tight"}`}>{averageValue(grade)}</dd>
            </dl>
            {(grade.remarks || grade.note) && <dl className="mt-4 space-y-3 text-sm">
              {grade.remarks && <div><dt className="text-xs text-muted-foreground">Remarks</dt><dd className="mt-1 wrap-anywhere">{grade.remarks}</dd></div>}
              {grade.note && <div><dt className="text-xs text-muted-foreground">Note</dt><dd className="mt-1 wrap-anywhere text-muted-foreground">{grade.note}</dd></div>}
            </dl>}
          </article>
        ))}
      </div>
      <div className="hidden lg:block">
        <PortalTable rows={rows} rowKey={(grade) => grade.classId} className="min-w-240"
          scrollAreaLabel="Semester grades" cellClassName="px-4 py-3 text-muted-foreground" rowClassName=""
          columns={[
            { header: "Code", className: "font-medium text-foreground", cell: (grade) => grade.code ?? "-" },
            { header: "Subject", className: "min-w-60 max-w-80 whitespace-normal text-foreground", cell: (grade) => <GradeSubject grade={grade} /> },
            { header: "Units", cell: (grade) => grade.units ?? "-" },
            { header: "Instructor", className: "min-w-36 whitespace-normal", cell: (grade) => grade.instructorName || "Not assigned" },
            ...gradingPeriods.map(([label, field, visibility]) => ({ header: label, cell: (grade: StudentClassGrade) => grade.periodVisibility[visibility] ? grade[field] ?? "-" : "Hidden" })),
            { header: "Ave", className: "font-semibold text-foreground", cell: averageValue },
            { header: "Remarks", className: "max-w-64 whitespace-normal", cell: (grade) => grade.remarks ?? "-" },
            { header: "Note", className: "max-w-64 whitespace-normal", cell: (grade) => grade.note ?? "-" },
          ]}
        />
      </div>
    </>
  );
}
