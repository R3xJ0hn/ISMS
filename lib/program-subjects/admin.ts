import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseProgramSubjectForm, parseProgramSubjectId, type ProgramSubjectFormState } from "./validation";

const subjectSelection = { id: true, name: true, code: true, units: true } as const;
const assignmentSelection = { subjectId: true, _count: { select: { classes: true } } } as const;

export async function getProgramSubjectEditData(programId: string) {
  await requireSuperAdmin();
  const id = parseProgramSubjectId(programId);
  if (id === null) return null;
  const [program, subjects] = await Promise.all([
    prisma.program.findUnique({ where: { id }, select: {
      id: true, code: true, label: true, programSubjects: { select: assignmentSelection },
    } }),
    prisma.subject.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], select: subjectSelection }),
  ]);
  if (!program) return null;
  return {
    program: { id: program.id.toString(), code: program.code, label: program.label },
    subjectIds: program.programSubjects.map(({ subjectId }) => subjectId.toString()),
    usedSubjectIds: program.programSubjects.filter(({ _count }) => _count.classes > 0).map(({ subjectId }) => subjectId.toString()),
    subjects: subjects.map((subject) => ({ id: subject.id.toString(), name: subject.name, code: subject.code, units: subject.units?.toString() ?? null })),
  };
}

export async function updateProgramSubjects(
  _previous: ProgramSubjectFormState,
  formData: FormData,
): Promise<ProgramSubjectFormState> {
  await requireSuperAdmin();
  const parsed = parseProgramSubjectForm(formData);
  if (!parsed.success) return parsed;
  try {
    const failure = await prisma.$transaction(async (tx): Promise<ProgramSubjectFormState | null> => {
      const program = await tx.program.findUnique({ where: { id: parsed.programId }, select: { id: true } });
      if (!program) return { success: false, message: "This program no longer exists." };
      const subjects = await tx.subject.findMany({ where: { id: { in: parsed.subjectIds } }, select: { id: true } });
      if (subjects.length !== parsed.subjectIds.length) return {
        success: false, message: "A selected subject is no longer available.",
        fieldErrors: { subjectIds: "Refresh the page and select existing subjects." },
      };
      const assignments = await tx.programSubject.findMany({ where: { programId: parsed.programId }, select: assignmentSelection });
      const selectedIds = new Set(parsed.subjectIds);
      const removed = assignments.filter(({ subjectId }) => !selectedIds.has(subjectId));
      if (removed.some(({ _count }) => _count.classes > 0)) return {
        success: false, message: "Subjects used by classes must remain assigned to this program.",
        fieldErrors: { subjectIds: "Keep subjects that are already used by classes. Update those classes before removing an assignment." },
      };
      const currentIds = new Set(assignments.map(({ subjectId }) => subjectId));
      const added = parsed.subjectIds.filter((subjectId) => !currentIds.has(subjectId));
      if (removed.length) await tx.programSubject.deleteMany({
        where: { programId: parsed.programId, subjectId: { in: removed.map(({ subjectId }) => subjectId) } },
      });
      if (added.length) await tx.programSubject.createMany({
        data: added.map((subjectId) => ({ programId: parsed.programId, subjectId })),
      });
      return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (failure) return failure;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2034" || error.code === "P2002") return {
        success: false, message: "Another administrator changed these subjects. Please refresh and try again.",
      };
      if (error.code === "P2003") return {
        success: false, message: "These assignments changed or are used by classes. Please refresh before trying again.",
      };
    }
    console.error("Failed to save program subject assignments.");
    return { success: false, message: "Unable to save program subjects. Please try again." };
  }
  for (const path of ["/portal/programs", `/portal/programs/${parsed.programId}/subjects`, "/portal/subjects", "/portal/classes", "/portal/classes/new"]) revalidatePath(path);
  return { success: true, message: "Program subjects saved successfully." };
}
