import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseProgramForm, type ProgramFormState } from "./validation";
import { revalidatePath } from "next/cache";

export async function updateProgram(
  _previous: ProgramFormState,
  formData: FormData,
): Promise<ProgramFormState> {
  await requireSuperAdmin();
  const parsed = parseProgramForm(formData);
  if (!parsed.success) return parsed;
  const { id, data } = parsed;

  let previousSlug: string | null;
  try {
    const [program, group, duplicate] = await Promise.all([
      prisma.program.findUnique({ where: { id }, select: { slug: true } }),
      data.groupId
        ? prisma.programGroup.findUnique({ where: { id: data.groupId }, select: { id: true } })
        : null,
      prisma.program.findFirst({
        where: { id: { not: id }, OR: [{ code: data.code }, ...(data.slug ? [{ slug: data.slug }] : [])] },
        select: { code: true, slug: true },
      }),
    ]);
    if (!program) return { success: false, message: "This program no longer exists." };
    if (data.groupId && !group) {
      return { success: false, message: "Choose an existing category.", fieldErrors: { groupId: "This category no longer exists." } };
    }
    if (duplicate) {
      const field = duplicate.code === data.code ? "code" : "slug";
      return {
        success: false, message: "A program already uses this code or URL.",
        fieldErrors: { [field]: "Choose a unique value." },
      };
    }
    previousSlug = program.slug;
    await prisma.program.update({ where: { id }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return { success: false, message: "A program already uses this code or URL." };
      if (error.code === "P2025") return { success: false, message: "This program no longer exists." };
      if (error.code === "P2003") return { success: false, message: "The selected category no longer exists." };
    }
    console.error("Failed to update program:", error);
    return { success: false, message: "Unable to save the program. Please try again." };
  }

  for (const path of [
    "/", "/programs", "/admission", "/portal/programs", `/portal/programs/${id}/edit`,
    "/portal/admission", "/portal/students",
    ...(previousSlug ? [`/programs/${previousSlug}`] : []),
    ...(data.slug ? [`/programs/${data.slug}`] : []),
  ]) revalidatePath(path);
  return { success: true, message: "Program updated successfully." };
}
