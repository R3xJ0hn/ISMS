import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { getAssignedClasses } from "@/lib/classes/teacher";
import { normalizeSpreadsheetUrl } from "@/lib/classes/validation";
import { ClassroomClassGrid } from "@/components/classroom/class-cards";
import { serializeClassStudentPreviews } from "@/lib/classes/student-preview";

export default async function MyClassesPage() {
  const classes = await getAssignedClasses();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <PortalPageHeader label="Your classroom" title="My Classes" description="A space for every class. Open one to manage your students and grade summary.">
        <PortalCount count={classes.length} label={classes.length === 1 ? "class" : "classes"} />
      </PortalPageHeader>
      <ClassroomClassGrid role="teacher" classes={classes.map(({ id, schoolYear, semester, sectionName, yearLevel, subjectName, spreadsheetUrl, branch, students, _count }) => ({
        id: id.toString(), href: `/portal/my-classes/${id}`, schoolYear, semester, sectionName, yearLevel, subjectName,
        branchTitle: branch?.title ?? null, studentCount: _count.students,
        studentPreviews: serializeClassStudentPreviews(students),
        spreadsheetLinked: Boolean(spreadsheetUrl && normalizeSpreadsheetUrl(spreadsheetUrl)),
      }))} />
    </main>
  );
}
