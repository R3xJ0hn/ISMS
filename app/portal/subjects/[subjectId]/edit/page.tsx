import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { getSubjectForEdit } from "@/lib/subjects/admin";
import { SubjectForm } from "../../subject-form";

export default async function EditSubjectPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const subject = await getSubjectForEdit((await params).subjectId);
  if (!subject) notFound();
  return (
    <PortalFormPage backHref="/portal/subjects" backLabel="Back to subjects"
      label="Subjects" title="Edit subject" description={`Update ${subject.values.name}.`}>
      <SubjectForm key={subject.id} mode="edit" subjectId={subject.id} values={subject.values} />
    </PortalFormPage>
  );
}
