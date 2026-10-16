import Link from "next/link";
import { Plus } from "lucide-react";
import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { getManagedLastSchools } from "@/lib/last-schools/admin";
import { LastSchoolsTable } from "./last-schools-table";

export default async function LastSchoolsManagementPage() {
  await requireAdmin();
  const schools = await getManagedLastSchools();
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Last Schools"
        description="Maintain the previous schools students can select and review new school suggestions.">
        <div className="flex flex-wrap items-center gap-3">
          <PortalCount count={schools.length} label="schools" />
          <Button asChild><Link href="/portal/last-schools/new"><Plus aria-hidden="true" />Add school</Link></Button>
        </div>
      </PortalPageHeader>
      <p className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Students can select verified schools. Suggestions stay pending until you check the school details and verify them.
        Reject an incorrect suggestion to keep it out of the school list.
      </p>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Last school records">
        <LastSchoolsTable schools={schools} />
      </section>
    </main>
  );
}
