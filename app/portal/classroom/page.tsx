import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ClassroomClassGrid } from "@/components/classroom/class-cards";
import { Button } from "@/components/ui/button";
import { getStudentClasses } from "@/lib/classes/student";

export default async function StudentClassroomPage() {
  const classes = await getStudentClasses();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your enrolled classes, teachers, and class grades in one place.</p>
        </div>
        <Button asChild variant="outline"><Link href="/portal/grades"><GraduationCap aria-hidden="true" />View all grades</Link></Button>
      </div>
      <ClassroomClassGrid
        classes={classes.map((assignedClass) => ({ ...assignedClass, href: `/portal/classroom/${assignedClass.id}` }))}
        role="student"
      />
    </main>
  );
}
