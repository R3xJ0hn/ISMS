import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { PortalAssignmentForm } from "@/components/portal/assignment-form";
import { getBranchProgramEditData } from "@/lib/branch-programs/admin";
import { formatProgramType } from "@/lib/utils";
import { saveBranchProgramsAction } from "../../actions";

export default async function EditBranchProgramsPage({ params }: { params: Promise<{ branchId: string }> }) {
  const data = await getBranchProgramEditData((await params).branchId);
  if (!data) notFound();
  return (
    <PortalFormPage className="min-w-0" backHref="/portal/branch-programs" backLabel="Back to branch programs"
      label="Manage Branch Programs" title={data.branch.title} description="Select the programs applicants can choose at this branch. Clear all selections to stop offering programs here.">
      <PortalAssignmentForm action={saveBranchProgramsAction} record={{ name: "branchId", id: data.branch.id }}
        itemsField="programIds" initialIds={data.programIds} singular="program" plural="programs" title="Programs offered"
        searchPlaceholder="Search programs..." returnTo="/portal/branch-programs"
        emptyState="No programs are available. Add programs to the catalog before assigning them to a branch."
        items={data.programs.map((program) => ({ id: program.id,
          label: <>{program.code} <span className="text-muted-foreground">{program.label}</span></>,
          description: <span className="mt-1 block text-xs text-muted-foreground">{formatProgramType(program.programType)}</span>,
          searchText: `${program.code} ${program.label} ${formatProgramType(program.programType)}`,
        }))} />
    </PortalFormPage>
  );
}
