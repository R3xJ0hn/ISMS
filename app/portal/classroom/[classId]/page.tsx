import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, GraduationCap, RefreshCw } from "lucide-react";
import { ClassBanner } from "@/components/classroom/class-banner";
import { ClassworkView } from "@/components/classroom/classwork-view";
import { StudentGradeSummary } from "@/components/classroom/student-grade-summary";
import { WorkspaceTabs } from "@/components/classroom/workspace-tabs";
import { Button } from "@/components/ui/button";
import { formatAcademicLevel, formatSemester } from "@/lib/academic-levels";
import { getStudentClass } from "@/lib/classes/student";

export default async function StudentClassroomDetailPage({ params, searchParams }: {
  params: Promise<{ classId: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}) {
  const assignedClass = await getStudentClass((await params).classId);
  if (!assignedClass) notFound();
  const tab = (await searchParams)?.tab;
  const defaultTab = tab === "grades" || tab === "classwork" ? tab : "overview";
  const { grades, student } = assignedClass;

  const overview = (
    <>
      <ClassBanner
        classId={assignedClass.id}
        classCode={assignedClass.classCode}
        subjectName={assignedClass.subjectName}
        sectionName={assignedClass.sectionName}
        schoolYear={assignedClass.schoolYear}
        semester={assignedClass.semester}
        yearLevel={assignedClass.yearLevel}
        branchTitle={assignedClass.branchTitle}
        teacherName={assignedClass.teacherName}
      />
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 rounded-xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-2"><BookOpen aria-hidden="true" className="size-5 text-blue-600 dark:text-blue-400" /><h2 className="font-semibold">About this class</h2></div>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            {[
              ["Subject", assignedClass.subjectName],
              ["Teacher", assignedClass.teacherName],
              ["Section", assignedClass.sectionName],
              ["Year level", formatAcademicLevel(assignedClass.yearLevel)],
              ["School year", assignedClass.schoolYear],
              ["Semester", formatSemester(assignedClass.semester)],
              ["Branch", assignedClass.branchTitle ?? "Not assigned"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium [overflow-wrap:anywhere]">{value}</dd></div>
            ))}
          </dl>
        </section>
        <aside className="h-fit min-w-0 rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Your student record</h2>
          <p className="mt-3 text-sm [overflow-wrap:anywhere]">{student.name}</p>
          <p className="mt-1 break-all text-sm text-muted-foreground">{student.studentNumber ? `Student number: ${student.studentNumber}` : "Student number not assigned"}</p>
          <Button asChild variant="outline" className="mt-5 w-full"><Link href="/portal/grades"><GraduationCap aria-hidden="true" />All semester grades</Link></Button>
        </aside>
      </div>
    </>
  );

  const gradeContent = (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
        <div className="min-w-0 flex-1"><h2 className="font-semibold">My class grades</h2><p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">Your grade summary for {assignedClass.subjectName}.</p></div>
        <Button asChild variant="outline" size="sm"><a href={`/portal/classroom/${assignedClass.id}?tab=grades`}><RefreshCw aria-hidden="true" />Refresh</a></Button>
      </div>
      {!grades.success ? (
        <div className="p-6 text-sm text-muted-foreground"><p>{grades.message}</p></div>
      ) : !grades.record ? (
        <div className="px-6 py-12 text-center"><h3 className="font-medium">No class grades yet</h3><p className="mt-2 text-sm text-muted-foreground">Your teacher has not posted a grade record for your student number.</p></div>
      ) : (
        <div className="p-5 md:p-6"><StudentGradeSummary record={grades.record} visibility={assignedClass.periodVisibility} /></div>
      )}
    </section>
  );

  return (
    <main className="mx-auto flex min-w-0 w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-8">
      <Button asChild variant="ghost" className="w-fit"><Link href="/portal/classroom"><ArrowLeft aria-hidden="true" />All classes</Link></Button>
      <WorkspaceTabs overview={overview} classwork={<ClassworkView result={assignedClass.classwork} role="student" refreshHref={`/portal/classroom/${assignedClass.id}?tab=classwork`} />} grades={gradeContent} defaultTab={defaultTab} />
    </main>
  );
}
