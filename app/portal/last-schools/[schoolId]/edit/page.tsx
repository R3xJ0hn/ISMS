import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { requireAdmin } from "@/lib/auth";
import { getManagedLastSchool } from "@/lib/last-schools/admin";
import { parseRecordId } from "@/lib/utils";
import { LastSchoolForm } from "../../school-form";

export default async function EditLastSchoolPage({ params }: { params: Promise<{ schoolId: string }> }) {
  await requireAdmin();
  const { schoolId } = await params;
  if (!parseRecordId(schoolId, { canonical: true, maxDigits: 19 })) notFound();
  const school = await getManagedLastSchool(schoolId);
  if (!school) notFound();
  return (
    <PortalFormPage backHref="/portal/last-schools" backLabel="Back to last schools" label="Last schools"
      title="Edit school" description="Review and correct the school details before making it available to students.">
      <LastSchoolForm key={school.id} mode="edit" school={school} />
    </PortalFormPage>
  );
}
