import { PortalFormPage } from "@/components/portal/page-header";
import { requireAdmin } from "@/lib/auth";
import { LastSchoolForm } from "../school-form";

export default async function AddLastSchoolPage() {
  await requireAdmin();
  return (
    <PortalFormPage backHref="/portal/last-schools" backLabel="Back to last schools" label="Last schools"
      title="Add school" description="Add a verified school for students to select in their admission details.">
      <LastSchoolForm mode="create" />
    </PortalFormPage>
  );
}
