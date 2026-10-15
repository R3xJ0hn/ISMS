import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { PortalAssignmentForm } from "@/components/portal/assignment-form";
import { getProgramSubjectEditData } from "@/lib/program-subjects/admin";
import { saveProgramSubjectsAction } from "./actions";

export default async function ProgramSubjectsPage({ params }: { params: Promise<{ programId: string }> }) {
  const data = await getProgramSubjectEditData((await params).programId);
  if (!data) notFound();
  return (
    <PortalFormPage className="min-w-0" backHref="/portal/programs" backLabel="Back to programs"
      label="Manage Programs" title={`${data.program.code} subjects`} description={`Assign subjects to ${data.program.label}. These subjects will be available when adding a class for this program.`}>
      <PortalAssignmentForm action={saveProgramSubjectsAction} record={{ name: "programId", id: data.program.id }}
        itemsField="subjectIds" initialIds={data.subjectIds} lockedIds={data.usedSubjectIds}
        singular="subject" plural="subjects" title="Subjects offered" searchPlaceholder="Search subject name or code..."
        returnTo="/portal/programs" clearLabel="Clear unused selections" lockedDescription="Subjects used by existing classes must remain assigned."
        emptyState={<>No subjects are available. <Link href="/portal/subjects" className="font-medium text-primary underline underline-offset-4">Add subjects in Manage Subjects</Link> before assigning them to a program.</>}
        items={data.subjects.map((subject) => ({ id: subject.id, label: subject.name,
          description: <>{subject.code && <span className="mt-1 block break-words text-xs text-muted-foreground">{subject.code}</span>}{subject.units !== null && <span className="mt-1 block text-xs text-muted-foreground">{subject.units} {Number(subject.units) === 1 ? "unit" : "units"}</span>}</>,
          searchText: `${subject.code ?? ""} ${subject.name}`,
        }))} />
    </PortalFormPage>
  );
}
