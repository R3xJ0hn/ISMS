import Link from "next/link";
import { notFound } from "next/navigation";
import { UserPlus } from "lucide-react";
import { PortalFormPage } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth";
import { parseClassId } from "@/lib/classes/validation";
import { getClassFormOptions } from "@/lib/classes/options";
import { prisma } from "@/lib/prisma";
import { ClassForm } from "../../class-form";

export default async function EditClassPage({ params }: { params: Promise<{ classId: string }> }) {
  await requireSuperAdmin();
  const id = parseClassId((await params).classId);
  if (id === null) notFound();

  const [classRecord, options] = await Promise.all([
    prisma.class.findUnique({
      where: { id },
      select: { id: true, schoolYear: true, semester: true, sectionName: true, yearLevel: true, teacherId: true, branchId: true, programId: true, subjectId: true, subjectName: true, students: { select: { studentId: true } } },
    }),
    getClassFormOptions(),
  ]);
  if (!classRecord) notFound();
  const { id: classId, teacherId, branchId, programId, subjectId, subjectName, students: roster, ...values } = classRecord;
  const { teachers } = options;

  return (
    <PortalFormPage backHref="/portal/classes" backLabel="Back to classes"
      label="Classes" title="Edit class" description={`Update the teacher and details for ${subjectName}, ${classRecord.sectionName}. The teacher manages their Google Sheets link.`}>
      {teachers.length > 0 ? (
        <ClassForm mode="edit" classId={classId.toString()} values={{ ...values, semester: values.semester ?? "", teacherId: teacherId.toString(), branchId: branchId?.toString() ?? "", programId: programId?.toString() ?? "", subjectId: subjectId?.toString() ?? "", studentIds: roster.map((entry) => entry.studentId.toString()) }} {...options} />
      ) : (
        <section className="max-w-3xl rounded-lg border border-border bg-card p-5 shadow-sm" aria-label="Add a teacher first">
          <h2 className="text-base font-semibold">Set up a teacher account to update this assignment</h2>
          <p className="mt-2 text-sm text-muted-foreground">Once the employee verifies their email and sets a password, return here to select the teacher responsible for this class.</p>
          <Button asChild className="mt-4"><Link href="/portal/teachers"><UserPlus aria-hidden="true" />Manage teachers</Link></Button>
        </section>
      )}
    </PortalFormPage>
  );
}
