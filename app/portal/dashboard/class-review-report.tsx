"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { formatSemester } from "@/lib/academic-levels";
import type { ClassRosterReview } from "@/lib/classes/roster-review";
import { useClassRosterReviews } from "../classes/use-class-roster-reviews";

const columns: InteractiveTableColumn<ClassRosterReview>[] = [
  { header: "Class", sortValue: (row) => `${row.classCode} ${row.subjectName}`, className: "min-w-48 max-w-72 whitespace-normal", cell: (row) => (
    <Link href={`/portal/classes/${row.id}?tab=cross-match`} prefetch={false} className="block rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
      <span className="font-mono text-xs">{row.classCode}</span><span className="mt-1 block font-semibold">{row.subjectName}</span><span className="mt-1 block text-xs text-muted-foreground">{row.sectionName}</span>
    </Link>
  ) },
  { header: "School year / Semester", sortValue: (row) => `${row.schoolYear} ${row.semester ?? ""}`, cell: (row) => <div><p>{row.schoolYear}</p><p className="mt-1 text-xs text-muted-foreground">{formatSemester(row.semester)}</p></div> },
  { header: "Teacher", sortValue: (row) => row.teacherName, className: "max-w-56 whitespace-normal", cell: (row) => row.teacherName },
  { header: "Review", sortValue: (row) => row.issueCount ?? -1, className: "min-w-64 whitespace-normal", cell: (row) => (
    <div>
      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${row.state === "needs_review" && row.severity === "attention" ? "border-red-200 bg-red-50 text-red-800" : row.state === "not_connected" ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {row.state === "needs_review" ? `Needs review (${row.issueCount})` : row.state === "unavailable" ? "Unable to check" : "Not connected"}
      </span>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{row.state === "needs_review"
        ? `${row.issueRows} sheet rows flagged · ${row.missingStudents} enrolled students missing from the sheet${row.nameDifferences ? ` · ${row.nameDifferences} name differences` : ""}`
        : row.message ?? "Connect a Google Sheet to check this class."}</p>
    </div>
  ) },
];

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export function ClassReviewReport() {
  const { report, loading, error, refresh } = useClassRosterReviews();
  const [category, setCategory] = useState("needs_review");
  const classes = report?.classes ?? [];
  const flagged = classes.filter((row) => row.state === "needs_review");
  const unavailable = classes.filter((row) => row.state === "unavailable");
  const disconnected = classes.filter((row) => row.state === "not_connected");
  const rows = classes.filter((row) => row.state === category).sort((left, right) =>
    Number(right.severity === "attention") - Number(left.severity === "attention") ||
    (right.issueCount ?? 0) - (left.issueCount ?? 0) || left.subjectName.localeCompare(right.subjectName));

  return (
    <section aria-labelledby="class-review-report-heading" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <h2 id="class-review-report-heading" className="font-semibold">Classes needing review</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Check spreadsheet rosters against saved students and class enrollment.</p>
          {report && <p className="mt-1 text-xs text-muted-foreground">Last report <time dateTime={report.checkedAt}>{dateFormatter.format(new Date(report.checkedAt))}</time></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" aria-disabled={loading} className="aria-disabled:cursor-wait aria-disabled:opacity-50" onClick={() => { if (!loading) void refresh(); }}><RefreshCw aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : undefined} />{loading ? "Checking rosters…" : "Refresh review"}</Button>
          <Button asChild variant="ghost" size="sm"><Link href="/portal/classes">Manage Classes<ArrowUpRight aria-hidden="true" /></Link></Button>
        </div>
      </div>
      {error && <p role="alert" className="m-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{error}{report ? " Showing the previous report below." : ""}</p>}
      {loading && !report && <p role="status" className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />Checking connected class spreadsheets…</p>}
      {report && <>
        <dl className="grid gap-3 p-5 sm:grid-cols-3" aria-label="Class review totals">
          {[
            { label: "Needs review", count: flagged.length, color: flagged.some((row) => row.severity === "attention") ? "text-red-700" : "text-amber-700" },
            { label: "Unable to check", count: unavailable.length, color: "text-amber-700" },
            { label: "Not connected", count: disconnected.length, color: "text-muted-foreground" },
          ].map(({ label, count, color }) => <div key={label} className="rounded-xl border border-border p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={`mt-1 text-2xl font-semibold ${count ? color : "text-foreground"}`}>{count}</dd></div>)}
        </dl>
        <p className="px-5 pb-4 text-xs text-muted-foreground">{classes.filter((row) => row.state === "matched").length} classes have no roster issues. Refresh to check the latest spreadsheet records.</p>
        <InteractivePortalTable rows={rows} columns={columns} rowKey={(row) => row.id} searchValue={(row) => `${row.classCode} ${row.subjectName} ${row.sectionName} ${row.teacherName} ${row.schoolYear} ${formatSemester(row.semester)}`}
          searchLabel="Search class review report" searchPlaceholder="Search class code, subject, or teacher..." rowLabel="classes" resetKey={category}
          emptyTitle={classes.length ? "No classes in this review category" : "No classes have been created yet"} className="min-w-200"
          toolbarControls={<select aria-label="Class review category" value={category} onChange={(event) => setCategory(event.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <option value="needs_review">Needs review ({flagged.length})</option><option value="unavailable">Unable to check ({unavailable.length})</option><option value="not_connected">Not connected ({disconnected.length})</option>
          </select>}
        />
      </>}
    </section>
  );
}
