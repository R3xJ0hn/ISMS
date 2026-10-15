import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseId } from "@/lib/utils";
import { ProgramEditForm } from "../../program-edit-form";

export default async function EditProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  await requireSuperAdmin();
  const id = parseId((await params).programId);
  if (id === null || id <= 0n || id > 9223372036854775807n) notFound();
  const [program, groups] = await Promise.all([
    prisma.program.findUnique({ where: { id }, select: {
      id: true, code: true, label: true, programType: true, slug: true, groupId: true,
      publicTitle: true, publicCode: true, note: true, overview: true,
      focusAreas: true, pathways: true, sortOrder: true,
    } }),
    prisma.programGroup.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], select: { id: true, title: true } }),
  ]);
  if (!program) notFound();
  const { id: programId, focusAreas, pathways, sortOrder, ...fields } = program;
  const values = {
    ...fields, slug: fields.slug ?? "", groupId: fields.groupId ?? "",
    publicTitle: fields.publicTitle ?? "", publicCode: fields.publicCode ?? "",
    note: fields.note ?? "", overview: fields.overview ?? "",
    focusAreas: focusAreas.join("\n"), pathways: pathways.join("\n"), sortOrder: String(sortOrder),
  };

  return (
    <PortalFormPage backHref="/portal/programs" backLabel="Back to programs"
      label="Manage Programs" title={`Edit ${program.code}`} description="Update admission information and the content shown on the public course page.">
      <ProgramEditForm programId={programId.toString()} values={values} groups={groups} />
    </PortalFormPage>
  );
}
