import { requireAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseBranchProgramForm, parseBranchProgramId, type BranchProgramFormState } from "./validation";

const programSelection = { id: true, code: true, label: true, programType: true } as const;

export async function getBranchProgramAssignments() {
  await requireAdmin();
  const branches = await prisma.branch.findMany({
    orderBy: [{ title: "asc" }, { id: "asc" }],
    select: {
      id: true, title: true, slug: true,
      branchPrograms: { orderBy: { program: { label: "asc" } }, select: { program: { select: programSelection } } },
    },
  });
  return branches.map(({ id, branchPrograms, ...branch }) => ({
    ...branch, id: id.toString(),
    programs: branchPrograms.map(({ program }) => ({ ...program, id: program.id.toString() })),
  }));
}

export async function getBranchProgramEditData(branchId: string) {
  await requireAdmin();
  const id = parseBranchProgramId(branchId);
  if (id === null) return null;
  const [branch, programs] = await Promise.all([
    prisma.branch.findUnique({ where: { id }, select: {
      id: true, title: true, branchPrograms: { select: { programId: true } },
    } }),
    prisma.program.findMany({ orderBy: [{ label: "asc" }, { id: "asc" }], select: programSelection }),
  ]);
  if (!branch) return null;
  return {
    branch: { id: branch.id.toString(), title: branch.title },
    programIds: branch.branchPrograms.map(({ programId }) => programId.toString()),
    programs: programs.map((program) => ({ ...program, id: program.id.toString() })),
  };
}

export async function updateBranchPrograms(
  _previous: BranchProgramFormState,
  formData: FormData,
): Promise<BranchProgramFormState> {
  await requireAdmin();
  const parsed = parseBranchProgramForm(formData);
  if (!parsed.success) return parsed;
  try {
    const failure = await prisma.$transaction(async (tx): Promise<BranchProgramFormState | null> => {
      const branch = await tx.branch.findUnique({ where: { id: parsed.branchId }, select: { id: true } });
      if (!branch) return { success: false, message: "This branch no longer exists." };
      const programs = await tx.program.findMany({ where: { id: { in: parsed.programIds } }, select: { id: true } });
      if (programs.length !== parsed.programIds.length) return {
        success: false, message: "A selected program is no longer available.",
        fieldErrors: { programIds: "Refresh the page and select existing programs." },
      };
      await tx.branchProgram.deleteMany({ where: { branchId: parsed.branchId } });
      if (parsed.programIds.length) await tx.branchProgram.createMany({
        data: parsed.programIds.map((programId) => ({ branchId: parsed.branchId, programId })),
      });
      return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (failure) return failure;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return {
      success: false, message: "Another administrator changed these offerings. Please refresh and try again.",
    };
    console.error("Failed to save branch program assignments.");
    return { success: false, message: "Unable to save branch programs. Please try again." };
  }
  for (const path of ["/admission", "/portal/branch-programs", `/portal/branch-programs/${parsed.branchId}/edit`]) revalidatePath(path);
  return { success: true, message: "Branch programs saved successfully." };
}
