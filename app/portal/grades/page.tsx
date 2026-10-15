import { formatStudentName } from "@/lib/utils";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { GradesView } from "@/app/portal/grades/grades-view";
import { PortalTable } from "@/components/portal/data-table";
import { requireSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { getStudentGrades, normalizeSemester } from "@/lib/student-grades";
import { filterSemesterGradesByVisibility, getStudentSemesterGradeVisibility } from "@/lib/classes/semester-visibility";

type PageProps = {
  searchParams?: Promise<{
    semester?: string | string[];
  }>;
};

export default async function StudentGradesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (session.role !== UserRole.student) {
    redirect("/portal");
  }

  const resolvedSearchParams = await searchParams;
  const semester = normalizeSemester(resolvedSearchParams?.semester);
  const initialVisibility = await getStudentSemesterGradeVisibility();
  const student = initialVisibility.student;
  let classes = initialVisibility.classes;

  let gradesResult = student?.studentNumber
    ? await getStudentGrades(student.studentNumber, semester)
    : {
        success: false as const,
        semester,
        message: "Your student number is not available yet.",
      };
  if (gradesResult.success && student) {
    // The spreadsheet request can take several seconds. Apply the latest portal
    // settings, and reject a result whose saved student identity changed meanwhile.
    const latestVisibility = await getStudentSemesterGradeVisibility();
    const latestStudent = latestVisibility.student;
    if (!latestStudent || latestStudent.id !== student.id || latestStudent.studentNumber !== student.studentNumber) {
      gradesResult = {
        success: false,
        semester,
        message: "Your student record has changed. Refresh the page to view your grades.",
      };
    } else {
      classes = latestVisibility.classes;
    }
  }
  const visibleGrades = gradesResult.success ? filterSemesterGradesByVisibility(gradesResult.grades, classes) : [];
  const hasHiddenPeriods = visibleGrades.some((grade) => Object.values(grade.periodVisibility).some((visible) => !visible));
  const displayName =
    gradesResult.success && gradesResult.studentName
      ? gradesResult.studentName
      : student
        ? formatStudentName(student)
        : "Student record";

  return (
    <main className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <GradesView
        semester={semester}
        displayName={displayName}
        studentNumber={student?.studentNumber ?? null}
      >
        {!gradesResult.success ? (
          <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-foreground" role="status">
            <div className="flex gap-3">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <h2 className="font-semibold">Grades unavailable</h2>
                <p className="mt-1 text-muted-foreground">
                  {gradesResult.message}
                </p>
                {!process.env.STUDENT_GRADES_APPS_SCRIPT_URL ? (
                  <p className="mt-2 text-muted-foreground">
                    Grades are unavailable right now; please contact support.
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        ) : (
          <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6">
              <h2 className="text-sm font-semibold text-foreground">
                {semester === "1stSem" ? "1st Semester" : "2nd Semester"}
              </h2>
              <span className="text-xs text-muted-foreground">{visibleGrades.length} {visibleGrades.length === 1 ? "subject" : "subjects"}</span>
            </div>
            {hasHiddenPeriods ? (
              <p className="border-b border-border bg-muted/30 px-5 py-3 text-sm text-muted-foreground sm:px-6" role="status">
                Your teacher has hidden some grading periods. Final averages and remarks appear when all periods are visible.
              </p>
            ) : null}
            {visibleGrades.length > 0 ? (
              <PortalTable
                rows={visibleGrades}
                rowKey={(grade, index) => `${grade.code ?? grade.subject}-${index}`}
                className="min-w-240"
                scrollAreaLabel="Semester grades"
                cellClassName="px-4 py-3 text-muted-foreground"
                rowClassName=""
                columns={[
                  { header: "Code", className: "font-medium text-foreground", cell: (grade) => grade.code ?? "-" },
                  { header: "Subject", className: "text-foreground", cell: (grade) => grade.subject },
                  { header: "Units", cell: (grade) => grade.units ?? "-" },
                  { header: "Instructor", cell: (grade) => grade.instructor_name ?? "-" },
                  { header: "Prelim", cell: (grade) => grade.periodVisibility.prelimVisible ? grade.prelim ?? "-" : "Hidden" },
                  { header: "Midterm", cell: (grade) => grade.periodVisibility.midtermVisible ? grade.midterm ?? "-" : "Hidden" },
                  { header: "Prefinals", cell: (grade) => grade.periodVisibility.prefinalsVisible ? grade.prefinals ?? "-" : "Hidden" },
                  { header: "Finals", cell: (grade) => grade.periodVisibility.finalsVisible ? grade.finals ?? "-" : "Hidden" },
                  { header: "Ave", className: "font-semibold text-foreground", cell: (grade) => grade.average ?? "-" },
                  { header: "Remarks", cell: (grade) => grade.remarks ?? "-" },
                  { header: "Note", cell: (grade) => grade.note ?? "-" },
                ]}
              />
            ) : (
              <div className="px-5 py-16 text-center">
                <h2 className="text-sm font-semibold text-foreground">
                  No grades found
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  No grade records were returned for this semester.
                </p>
              </div>
            )}
          </section>
        )}
      </GradesView>
    </main>
  );
}
