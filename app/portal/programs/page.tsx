import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProgramsTable } from "./programs-table";

export default async function ProgramsManagementPage() {
  await requireSuperAdmin();
  const programs = await prisma.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    select: {
      id: true, label: true, code: true, programType: true, slug: true,
      publicTitle: true, publicCode: true, overview: true, sortOrder: true,
      group: { select: { title: true } },
    },
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Programs" description="Manage program information for admissions and public course pages.">
        <PortalCount count={programs.length} label="programs" />
      </PortalPageHeader>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Program catalog">
        <ProgramsTable programs={programs.map((program) => ({
          id: program.id.toString(), label: program.label, code: program.code,
          programType: program.programType, category: program.group?.title ?? "Unassigned",
          slug: program.slug, sortOrder: program.sortOrder,
          listed: Boolean(program.slug && program.group && program.publicTitle && program.publicCode && program.overview),
        }))} />
      </section>
    </main>
  );
}
