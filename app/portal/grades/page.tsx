import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { GradesView } from "@/app/portal/grades/grades-view";
import { StudentGradesTable } from "./grades-table";
import { requireSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { getStudentClassGrades } from "@/lib/classes/student-grades";

type PageProps = {
  searchParams?: Promise<{
    semester?: string | string[];
    schoolYear?: string | string[];
  }>;
};

export default async function StudentGradesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (session.role !== UserRole.student) redirect("/portal");
  const params = await searchParams;
  const report = await getStudentClassGrades({ schoolYear: params?.schoolYear, semester: params?.semester });
  const { student, grades } = report;
  const semesterLabel = report.semester === "unassigned" ? "Semester not assigned" : report.semester === "2ndSem" ? "2nd Semester" : "1st Semester";
  const hasHiddenPeriods = grades.some((grade) => Object.values(grade.periodVisibility).some((visible) => !visible));
  const unavailableCount = grades.filter((grade) => grade.availability === "unavailable" || grade.availability === "not_connected").length;

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <GradesView semester={report.semester} schoolYear={report.schoolYear} schoolYears={report.schoolYears}
        hasUnassignedSemester={report.hasUnassignedSemester} displayName={student?.name ?? "Student record"}
        studentNumber={student?.studentNumber ?? null}>
        {report.message && !student && <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-foreground" role="status">
          <div className="flex gap-3">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div><h2 className="font-semibold">Grades unavailable</h2><p className="mt-1 text-muted-foreground">{report.message}</p></div>
          </div>
        </section>}
        {student && <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
            <h2 className="text-sm font-semibold text-foreground">{report.schoolYear ? `${report.schoolYear} / ${semesterLabel}` : semesterLabel}</h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground">{grades.length} {grades.length === 1 ? "class" : "classes"}</span>
              <a href={`/portal/grades?${new URLSearchParams({ ...(report.schoolYear ? { schoolYear: report.schoolYear } : {}), semester: report.semester })}`}
                className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Refresh grades</a>
            </div>
          </div>
          {hasHiddenPeriods && <p className="border-b border-border bg-muted/30 px-5 py-3 text-sm text-muted-foreground sm:px-6" role="status">
            Your teacher has hidden some grading periods. Final averages and remarks appear when all periods are visible.
          </p>}
          {unavailableCount > 0 && <p className="border-b border-border bg-amber-50 px-5 py-3 text-sm text-amber-900 sm:px-6" role="status">
            {unavailableCount} {unavailableCount === 1 ? "class is" : "classes are"} unavailable right now. Check the message beneath each subject; available grades are still shown.
          </p>}
          {grades.length ? <StudentGradesTable grades={grades} /> : <div className="px-5 py-16 text-center">
            <h2 className="text-sm font-semibold text-foreground">No classes found</h2>
            <p className="mt-1 text-sm text-muted-foreground">{report.schoolYears.length ? "You are not enrolled in any classes for this school year and semester. Choose another filter or contact the registrar." : "Your grades will appear after you are enrolled in a class."}</p>
          </div>}
        </section>}
      </GradesView>
    </main>
  );
}
