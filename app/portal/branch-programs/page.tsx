import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { getBranchProgramAssignments } from "@/lib/branch-programs/admin";
import { BranchProgramsTable } from "./branch-programs-table";

export default async function BranchProgramsPage() {
  const branches = await getBranchProgramAssignments();
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Branch Programs" description="Choose the programs each branch offers on the public admission page.">
        <PortalCount count={branches.length} label="branches" />
      </PortalPageHeader>
      <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Branch program offerings">
        <BranchProgramsTable branches={branches} />
      </section>
    </main>
  );
}
