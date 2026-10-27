"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { StudentThumbnails } from "@/components/portal/student-thumbnails";
import { academicLevelOptions, formatAcademicLevel, formatSemester, semesterOptions } from "@/lib/academic-levels";
import { classTableGrouping } from "@/lib/classes/grouping";
import { classStatusOptions, getClassStatusOption } from "@/lib/classes/presentation";
import type { ClassStudentPreview } from "@/lib/classes/student-preview";
import type { AcademicLevel, ClassStatus, Semester } from "@/lib/generated/prisma/enums";
import type { ClassRosterReview } from "@/lib/classes/roster-review";
import { useClassRosterReviews } from "./use-class-roster-reviews";

export type ClassTableRow = {
  id: string;
  classCode: string;
  status: ClassStatus;
  schoolYear: string;
  semester?: Semester | null;
  branchId: string | null;
  branchTitle: string | null;
  programId: string | null;
  programLabel?: string | null;
  sectionName: string;
  yearLevel: AcademicLevel;
  subjectName: string;
  teacherEmail: string;
  teacherName?: string;
  studentCount?: number;
  studentPreviews?: ClassStudentPreview[];
  spreadsheetLinked: boolean;
};

function RosterReviewMark({ record, review, loading, error }: {
  record: ClassTableRow;
  review: ClassRosterReview | undefined;
  loading: boolean;
  error: string | null;
}) {
  if (!record.spreadsheetLinked) return null;
  const href = `/portal/classes/${record.id}?tab=cross-match`;
  const badgeClassName = "mt-1.5 inline-flex w-fit rounded-md border px-2 py-0.5 text-xs font-medium";
  if (error || review?.state === "unavailable") return <Link href={href} title={error ?? review?.message ?? undefined}
    aria-label={`Unable to check roster for ${record.classCode}`} className={`${badgeClassName} border-amber-200 bg-amber-50 text-amber-800 hover:underline`}>Unable to check</Link>;
  if (review?.state === "needs_review") {
    const label = `Needs review${review.issueCount === null ? "" : ` (${review.issueCount})`}`;
    return <Link href={href} aria-label={`${label} for ${record.classCode}`} className={`${badgeClassName} ${review.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800"} hover:underline`}>{label}</Link>;
  }
  if (review?.state === "matched") return <span className={`${badgeClassName} border-emerald-200 bg-emerald-50 text-emerald-800`}>Matched</span>;
  if (review?.state === "not_connected") return <span className="mt-1.5 block text-xs text-muted-foreground">Not connected</span>;
  return <span className="mt-1.5 block text-xs text-muted-foreground">{loading ? "Checking roster…" : "Not checked"}</span>;
}

function classColumns(reviews: Map<string, ClassRosterReview>, loading: boolean, error: string | null): InteractiveTableColumn<ClassTableRow>[] {
  return [
  { header: "Class code", sortValue: (classRecord) => classRecord.classCode, className: "whitespace-nowrap", cell: (classRecord) => <span className="font-mono text-xs font-medium">{classRecord.classCode}</span> },
  { header: "Subject", sortValue: (classRecord) => classRecord.subjectName, className: "max-w-56 whitespace-normal", cell: (classRecord) => <div className="flex flex-col items-start"><Link href={`/portal/classes/${classRecord.id}`} className="font-semibold text-primary hover:underline" aria-label={`View ${classRecord.subjectName}, ${classRecord.classCode}`}>{classRecord.subjectName}</Link><RosterReviewMark record={classRecord} review={reviews.get(classRecord.id)} loading={loading} error={error} /></div> },
  { header: "Section", sortValue: (classRecord) => classRecord.sectionName, cell: (classRecord) => <p className="font-semibold">{classRecord.sectionName}</p> },
  { header: "School year / Semester", sortValue: (classRecord) => `${classRecord.schoolYear} ${formatSemester(classRecord.semester)}`, className: "whitespace-nowrap", cell: (classRecord) => <div><p className="font-medium">{classRecord.schoolYear}</p><p className="mt-1 text-xs text-muted-foreground">{formatSemester(classRecord.semester)}</p></div> },
  { header: "Teacher", sortValue: (classRecord) => classRecord.teacherName ?? classRecord.teacherEmail, className: "max-w-60 break-words", cell: (classRecord) => <div><p className="font-medium">{classRecord.teacherName ?? classRecord.teacherEmail}</p>{classRecord.teacherName && <p className="break-all text-xs text-muted-foreground">{classRecord.teacherEmail}</p>}</div> },
  { header: "Status", sortValue: (classRecord) => classStatusOptions.findIndex((option) => option.value === classRecord.status), className: "whitespace-nowrap", cell: (classRecord) => {
    const status = getClassStatusOption(classRecord.status) ?? classStatusOptions[0];
    return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${status.badgeClassName}`}>{status.label}</span>;
  } },
  { header: "Students", sortValue: (classRecord) => classRecord.studentCount ?? 0, cell: (classRecord) => classRecord.studentPreviews?.length ? (
    <StudentThumbnails students={classRecord.studentPreviews} count={classRecord.studentCount} />
  ) : <span className="whitespace-nowrap text-muted-foreground">{classRecord.studentCount ? `${classRecord.studentCount} students` : "No students"}</span> },
  {
    header: "Spreadsheet",
    sortValue: (classRecord) => classRecord.spreadsheetLinked,
    cell: (classRecord) => <span className={classRecord.spreadsheetLinked ? "font-medium" : "text-muted-foreground"}>{classRecord.spreadsheetLinked ? "Linked" : "Not linked"}</span>,
  },
  {
    header: "Actions",
    cell: (classRecord) => (
      <Link href={`/portal/classes/${classRecord.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit ${classRecord.subjectName} for ${classRecord.sectionName}, ${classRecord.schoolYear}`}>
        <Pencil className="size-4" aria-hidden="true" />Edit
      </Link>
    ),
  },
];
}

function searchValue(classRecord: ClassTableRow) {
  return [classRecord.classCode, getClassStatusOption(classRecord.status)?.label ?? "Ongoing", classRecord.branchTitle ?? "Not assigned", classRecord.programLabel ?? "", classRecord.schoolYear, formatSemester(classRecord.semester), classRecord.sectionName, formatAcademicLevel(classRecord.yearLevel), classRecord.subjectName, classRecord.teacherName, classRecord.teacherEmail, classRecord.spreadsheetLinked ? "Linked" : "Not linked"].join(" ");
}

export function ClassesTable({ classes }: { classes: ClassTableRow[] }) {
  const filterId = useId();
  const { report, loading, error, refresh } = useClassRosterReviews();
  const reviews = new Map(report?.classes.map((review) => [review.id, review]) ?? []);
  const columns = classColumns(reviews, loading, error);
  const [filters, setFilters] = useState({ branch: "", schoolYear: "", yearLevel: "", program: "", semester: "", status: "" });
  const branches = [...new Map(classes.filter((row) => row.branchId !== null).map((row) => [row.branchId!, row.branchTitle ?? "Unnamed branch"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  const programs = [...new Map(classes.filter((row) => row.programId !== null).map((row) => [row.programId!, row.programLabel ?? "Unnamed program"])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }));
  const schoolYears = [...new Set(classes.map((row) => row.schoolYear))].sort((a, b) => b.localeCompare(a));
  const controls = [
    { name: "branch", label: "Branch", all: "All branches", options: [...branches, ...(classes.some((row) => row.branchId === null) ? [{ value: "unassigned", label: "Branch not assigned" }] : [])] },
    { name: "schoolYear", label: "School year", all: "All school years", options: schoolYears.map((value) => ({ value, label: value })) },
    { name: "yearLevel", label: "Year level", all: "All year levels", options: academicLevelOptions.filter((level) => classes.some((row) => row.yearLevel === level.value)) },
    { name: "program", label: "Program", all: "All programs", options: [...programs, ...(classes.some((row) => row.programId === null) ? [{ value: "unassigned", label: "Program not assigned" }] : [])] },
    { name: "semester", label: "Semester", all: "All semesters", options: [...semesterOptions, ...(classes.some((row) => row.semester == null) ? [{ value: "unassigned", label: "Semester not assigned" }] : [])] },
    { name: "status", label: "Status", all: "All statuses", options: classStatusOptions },
  ] satisfies { name: keyof typeof filters; label: string; all: string; options: readonly { value: string; label: string }[] }[];
  const matches = (filter: string, value: string | null | undefined) => !filter || (filter === "unassigned" ? value == null : value === filter);
  const rows = classes.filter((row) => matches(filters.branch, row.branchId) && matches(filters.program, row.programId)
    && matches(filters.schoolYear, row.schoolYear) && matches(filters.yearLevel, row.yearLevel) && matches(filters.semester, row.semester) && matches(filters.status, row.status));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
      {error ? <p role="alert" className="min-w-0 flex-1 text-sm text-amber-800">{error}</p>
        : <p role="status" className="min-w-0 text-xs text-muted-foreground">{loading ? "Checking connected class rosters…" : "Review marks compare spreadsheet students with saved class enrollment."}</p>}
      <Button type="button" variant="outline" size="sm" aria-disabled={loading} disabled={classes.length === 0}
        className="aria-disabled:cursor-wait aria-disabled:opacity-50" onClick={() => { if (!loading && classes.length > 0) void refresh(); }}>
        <RefreshCw aria-hidden="true" className={loading ? "animate-spin motion-reduce:animate-none" : undefined} />{loading ? "Checking rosters…" : report ? "Refresh review" : "Check rosters"}
      </Button>
    </div>
    <InteractivePortalTable
      resetKey={JSON.stringify(filters)} toolbarLayout="single-row" grouping={classTableGrouping} rows={rows} columns={columns} rowKey={(classRecord) => classRecord.id} searchValue={searchValue}
      searchLabel="Search classes" searchPlaceholder="Search code, subject, section, or teacher..."
      initialSort={{ column: "Subject", direction: "asc" }} rowLabel="classes" emptyTitle={hasFilters ? "No classes match these filters" : "No class assignments yet"}
      className="min-w-240" cellClassName="px-4 py-3 align-middle"
      toolbarControls={<div role="group" aria-label="Class filters" className="flex w-full min-w-0 items-start gap-2 md:w-auto md:flex-1">
        <div role="region" aria-label="Scrollable class filters" tabIndex={0} className="relative min-w-0 flex-1 overflow-x-auto overscroll-x-contain p-0.5 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex w-max items-start gap-3">
            {controls.map((control) => <div key={control.name} className="w-40 shrink-0">
              <label htmlFor={`${filterId}-${control.name}`} className="block text-xs font-medium text-muted-foreground md:sr-only">{control.label}</label>
              <select id={`${filterId}-${control.name}`} aria-label={`Filter by ${control.label.toLowerCase()}`}
                value={filters[control.name]} onChange={(event) => setFilters((current) => ({ ...current, [control.name]: event.target.value }))}
                className="mt-1.5 h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:mt-0">
                <option value="">{control.all}</option>
                {control.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>)}
          </div>
        </div>
        {hasFilters && <Button type="button" variant="ghost" aria-label="Clear filters" title="Clear filters" className="mt-6 size-9 shrink-0 whitespace-nowrap px-0 sm:w-auto sm:px-4 md:mt-0.5" onClick={() => setFilters({ branch: "", schoolYear: "", yearLevel: "", program: "", semester: "", status: "" })}>
          <X aria-hidden="true" /><span className="hidden sm:inline">Clear filters</span>
        </Button>}
      </div>}
    />
    </>
  );
}
