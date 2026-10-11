import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PortalPageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
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
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <Button asChild variant="outline" className="w-fit">
        <Link href="/portal/programs">
          <ArrowLeft aria-hidden="true" />
          Back to programs
        </Link>
      </Button>
      <PortalPageHeader label="Programs" title={`Edit ${program.code}`} description="Update admission information and the content shown on the public course page." />
      <ProgramEditForm programId={programId.toString()} values={values} groups={groups} />
    </main>
  );
}
