import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClassworkView } from "@/components/classroom/classwork-view";
import { StudentIdentity } from "@/components/portal/student-identity";
import { Button } from "@/components/ui/button";
import { getTeacherStudentRecords } from "@/lib/classes/teacher-student-records";

export default async function TeacherStudentRecordsPage({ params }: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;
  const records = await getTeacherStudentRecords(classId, studentId);
  if (!records) notFound();
  const refreshHref = `/portal/my-classes/${records.classId}/students/${records.student.id}`;
  return (
    <main className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Button asChild variant="ghost" className="-ml-3 w-fit text-muted-foreground">
        <Link href={`/portal/my-classes/${records.classId}?tab=grades`}><ArrowLeft aria-hidden="true" />Back to grades</Link>
      </Button>
      <header className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Student activity records</h1>
          <p className="mt-2 wrap-anywhere text-sm text-muted-foreground">{records.classCode} · {records.subjectName}</p>
        </div>
        <StudentIdentity id={records.student.id} name={records.student.name} imageUrl={records.student.imageUrl} nameClassName="text-lg font-semibold" />
        <p className="wrap-anywhere text-sm text-muted-foreground">Student number: {records.student.studentNumber ?? "Not assigned"}</p>
        <p className="text-xs text-muted-foreground">You can view all grading periods as the assigned teacher, including periods hidden from students.</p>
      </header>
      <ClassworkView result={records.classwork} role="student" studentName={records.student.name} refreshHref={refreshHref} />
    </main>
  );
}
