import { requireSuperAdmin } from "@/lib/auth";
import { PortalFormPage } from "@/components/portal/page-header";
import { SubjectForm } from "../subject-form";

export default async function AddSubjectPage() {
  await requireSuperAdmin();
  return (
    <PortalFormPage backHref="/portal/subjects" backLabel="Back to subjects"
      label="Subjects" title="Add subject" description="Create a subject to assign to a program and use in classes.">
      <SubjectForm mode="create" />
    </PortalFormPage>
  );
}
