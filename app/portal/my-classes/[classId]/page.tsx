import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, RefreshCw, Users } from "lucide-react";
import { RosterCrossMatchView } from "@/components/portal/roster-cross-match-view";
import { Button } from "@/components/ui/button";
import { ClassBanner } from "@/components/classroom/class-banner";
import { ClassworkView } from "@/components/classroom/classwork-view";
import { WorkspaceTabs } from "@/components/classroom/workspace-tabs";
import { getAssignedClass } from "@/lib/classes/teacher";
import { getClassPeriodVisibility } from "@/lib/classes/period-visibility";
import { getClassRosterComparison } from "@/lib/classes/roster-comparison";
import { getClassSummary, getClassworkCatalog } from "@/lib/classes/spreadsheet";
import { normalizeSpreadsheetUrl } from "@/lib/classes/validation";
import { formatDateTime, formatStudentName } from "@/lib/utils";
import { StudentSummaryTable } from "../student-summary-table";
import { SpreadsheetConnectionCard } from "../spreadsheet-connection-card";
import { PeriodVisibilityCard } from "../period-visibility-card";

export default async function ClassSummaryPage({ params, searchParams }: {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const assignedClass = await getAssignedClass((await params).classId);
  if (!assignedClass) notFound();
  const selectedTab = (await searchParams)?.tab;
  const [summary, classwork, crossMatch] = await Promise.all([
    assignedClass.spreadsheetUrl ? getClassSummary(assignedClass.spreadsheetUrl) : null,
    assignedClass.spreadsheetUrl ? getClassworkCatalog(assignedClass.spreadsheetUrl) : null,
    getClassRosterComparison(assignedClass.spreadsheetUrl, assignedClass.students.map(({ student }) => ({
      id: student.id, studentNumber: student.studentNumber, firstName: student.firstName,
      middleName: student.middleName, lastName: student.lastName, suffix: student.suffix,
    }))),
  ]);
  const spreadsheetUrl = assignedClass.spreadsheetUrl ? normalizeSpreadsheetUrl(assignedClass.spreadsheetUrl) : null;
  const studentsHref = `/portal/my-classes/${assignedClass.id}?tab=students`;
  const visibility = getClassPeriodVisibility(assignedClass);
  const roster = assignedClass.students.map(({ student }) => ({
    id: student.id.toString(), name: formatStudentName(student), studentNumber: student.studentNumber,
    imageUrl: student.userImage ?? null,
  }));

  const grades = (
    <>
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Grade summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">{summary.success ? `Loaded ${formatDateTime(new Date())}` : "Student summary"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={`/portal/my-classes/${assignedClass.id}?tab=grades`}><RefreshCw aria-hidden="true" />Refresh summary</a></Button>
            {spreadsheetUrl && (
              <Button asChild variant="outline"><a href={spreadsheetUrl} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />Open spreadsheet</a></Button>
            )}
          </div>
        </div>
      )}
      {!summary ? (
        <section className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center" aria-label="Set up your class spreadsheet">
          <BookOpen aria-hidden="true" className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h2 className="text-base font-semibold">Your class summary will appear here</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Add your Google Sheets link in Overview to load student records and grade summaries for this class.</p>
        </section>
      ) : summary.success ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" aria-label="Student summary records">
          <StudentSummaryTable students={summary.students} roster={roster} />
        </section>
      ) : (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          <h2 className="font-semibold">Unable to load student records</h2>
          <p className="mt-2">{summary.message}</p>
          <p className="mt-2">Check your link in Overview and the spreadsheet&apos;s sharing permissions, then refresh the summary. If the problem continues, ask the administrator to check the portal&apos;s spreadsheet connection.</p>
        </div>
      )}
    </>
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Button asChild variant="ghost" className="w-fit -ml-3 text-muted-foreground">
        <Link href="/portal/my-classes"><ArrowLeft aria-hidden="true" />Back to my classes</Link>
      </Button>
      <WorkspaceTabs
        defaultTab={selectedTab === "grades" || selectedTab === "students" || selectedTab === "classwork" ? selectedTab : "overview"}
        overview={(
          <>
            <ClassBanner classId={assignedClass.id.toString()} classCode={assignedClass.classCode} subjectName={assignedClass.subjectName} sectionName={assignedClass.sectionName} schoolYear={assignedClass.schoolYear} semester={assignedClass.semester} yearLevel={assignedClass.yearLevel} branchTitle={assignedClass.branch?.title ?? null} />
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users aria-hidden="true" className="size-5" /></div>
                <div><p className="text-2xl font-semibold">{assignedClass.students.length}</p><h2 className="text-sm text-muted-foreground">Students in your class</h2></div>
              </section>
              <SpreadsheetConnectionCard classId={assignedClass.id.toString()} spreadsheetUrl={spreadsheetUrl} />
            </div>
            <PeriodVisibilityCard key={assignedClass.id.toString()} classId={assignedClass.id.toString()} visibility={visibility} />
          </>
        )}
        classwork={<ClassworkView result={classwork} role="teacher" refreshHref={`/portal/my-classes/${assignedClass.id}?tab=classwork`} />}
        students={<RosterCrossMatchView result={crossMatch} enrolledCount={assignedClass.students.length}
          connected={Boolean(assignedClass.spreadsheetUrl)} spreadsheetUrl={spreadsheetUrl} refreshHref={studentsHref} />}
        grades={grades}
      />
    </main>
  );
}
