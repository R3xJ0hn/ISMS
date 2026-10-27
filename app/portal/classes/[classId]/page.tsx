import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Pencil, RefreshCw, Users } from "lucide-react";
import { PortalFormPage } from "@/components/portal/page-header";
import { RosterCrossMatchView } from "@/components/portal/roster-cross-match-view";
import { Button } from "@/components/ui/button";
import { formatAcademicLevel, formatSemester } from "@/lib/academic-levels";
import { getManagedClassView } from "@/lib/classes/class-view";
import { mergeEnrolledStudentGrades } from "@/lib/classes/enrolled-grades";
import { getClassStatusOption } from "@/lib/classes/presentation";
import { normalizeSpreadsheetUrl } from "@/lib/classes/validation";
import { getEmployeeFullName } from "@/lib/employees/names";
import { cn, formatStudentName } from "@/lib/utils";
import { ClassStudentsTable } from "./class-students-table";

export default async function ManagedClassPage({ params, searchParams }: {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const crossMatchSelected = (await searchParams)?.tab === "cross-match";
  const view = await getManagedClassView((await params).classId, crossMatchSelected);
  if (!view) notFound();
  const { record, crossMatch, summary } = view;
  const href = `/portal/classes/${record.id}`;
  const spreadsheetUrl = record.spreadsheetUrl ? normalizeSpreadsheetUrl(record.spreadsheetUrl) : null;
  const status = getClassStatusOption(record.status) ?? getClassStatusOption("ongoing")!;
  const gradeAvailability = summary?.success ? "Available" : record.spreadsheetUrl ? "Unavailable" : "No Google Sheet connected";
  const details = [
    { label: "School year / Semester", value: `${record.schoolYear} / ${formatSemester(record.semester)}` },
    { label: "Program", value: record.program ? `${record.program.code} — ${record.program.label}` : "Not assigned" },
    { label: "Year level / Section", value: `${formatAcademicLevel(record.yearLevel)} / ${record.sectionName}` },
    { label: "Branch", value: record.branch?.title ?? "Not assigned" },
    { label: "Teacher", value: getEmployeeFullName(record.teacher.employee) },
  ];

  return (
    <PortalFormPage backHref="/portal/classes" backLabel="Back to Manage Classes" label="Class view" title={record.subjectName}
      description="View enrolled students and grades, or cross-match the connected Google Sheet with saved student records."
      className="min-w-0" headerActions={<Button asChild variant="outline" className="w-fit"><Link href={`${href}/edit`}><Pencil aria-hidden="true" />Edit class</Link></Button>}>
      <nav aria-label="Class view tabs" className="flex min-w-0 gap-1 overflow-x-auto border-b border-border">
        {[{ name: "Student list", path: href, active: !crossMatchSelected, icon: Users }, { name: "Google Sheets cross-match", path: `${href}?tab=cross-match`, active: crossMatchSelected, icon: FileSpreadsheet }].map((tab) => (
          <Link key={tab.name} href={tab.path} prefetch={false} aria-current={tab.active ? "page" : undefined}
            className={cn("inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring", tab.active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <tab.icon aria-hidden="true" className="size-4" />{tab.name}
          </Link>
        ))}
      </nav>
      <section aria-label="Class details" className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">Class code <span className="ml-2 font-mono font-semibold text-foreground">{record.classCode}</span></p>
          <span className={`rounded-full border px-2 py-1 text-xs font-medium ${status.badgeClassName}`}>{status.label}</span>
        </div>
        <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {details.map(({ label, value }) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}
        </dl>
      </section>

      {!crossMatchSelected ? (
        <section aria-labelledby="enrolled-students-heading" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div className="min-w-0"><h2 id="enrolled-students-heading" className="font-semibold">Enrolled students ({record.students.length})</h2><p className="mt-1 text-sm text-muted-foreground">Grades from the connected Google Sheet, matched by student number. Use Edit class to change enrollment.</p></div>
            <Button asChild variant="outline" size="sm"><a href={href}><RefreshCw aria-hidden="true" />Refresh grades</a></Button>
          </div>
          {!summary?.success && <div role="alert" className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5">
            <p className="font-medium">{record.spreadsheetUrl ? "Unable to load class grades" : "No Google Sheet connected"}</p>
            <p className="mt-1">{summary && !summary.success ? summary.message : "Please refresh to load class grades."} The enrolled list is still available; Excel exports will mark grades as unavailable.</p>
          </div>}
          <ClassStudentsTable students={mergeEnrolledStudentGrades(
            record.students.map(({ student }) => ({ id: student.id.toString(), name: formatStudentName(student), studentNumber: student.studentNumber, imageUrl: student.userImage })),
            summary?.success ? summary.students : [],
          )} gradeAvailability={gradeAvailability} exportDetails={{
            classCode: record.classCode, subjectName: record.subjectName, schoolYear: record.schoolYear,
            semester: formatSemester(record.semester), program: record.program?.code ?? "Not assigned",
            yearLevel: formatAcademicLevel(record.yearLevel), sectionName: record.sectionName,
            branch: record.branch?.title ?? "Not assigned", teacher: getEmployeeFullName(record.teacher.employee), gradeAvailability,
          }} />
        </section>
      ) : (
        <RosterCrossMatchView result={crossMatch} enrolledCount={record.students.length} connected={Boolean(record.spreadsheetUrl)}
          spreadsheetUrl={spreadsheetUrl} refreshHref={`${href}?tab=cross-match`} />
      )}
    </PortalFormPage>
  );
}
