import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { literalInsensitiveEquality } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { parseSubjectForm, parseSubjectId, type SubjectFormState } from "./validation";

export type SubjectOverview = {
  id: string;
  name: string;
  code: string | null;
  units: string | null;
  programCount: number;
  classCount: number;
};

function missingSubjectError(): SubjectFormState {
  return { success: false, message: "This subject no longer exists.", fieldErrors: { subjectId: "Choose an existing subject." } };
}

// PostgreSQL implements insensitive equality with ILIKE; match punctuation literally.
async function duplicateSubjectError(
  transaction: Prisma.TransactionClient,
  data: { name: string; code: string | null },
  id?: bigint,
): Promise<SubjectFormState | null> {
  const exclusion = id === undefined ? {} : { id: { not: id } };
  const [name, code] = await Promise.all([
    transaction.subject.findFirst({ where: { ...exclusion, name: literalInsensitiveEquality(data.name) }, select: { id: true } }),
    data.code ? transaction.subject.findFirst({ where: { ...exclusion, code: literalInsensitiveEquality(data.code) }, select: { id: true } }) : null,
  ]);
  if (!name && !code) return null;
  return {
    success: false, message: "A subject already uses this name or code.",
    fieldErrors: {
      ...(name ? { name: "Choose a name that is not already in use." } : {}),
      ...(code ? { code: "Choose a code that is not already in use." } : {}),
    },
  };
}

function saveSubjectError(error: unknown): SubjectFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { success: false, message: "A subject already uses this name or code." };
    if (error.code === "P2025") return missingSubjectError();
    if (error.code === "P2034") return { success: false, message: "Subjects changed while saving. Please try again." };
  }
  console.error("Failed to save subject.");
  return { success: false, message: "Unable to save the subject. Please try again." };
}

function refreshSubjectPages() {
  for (const path of ["/portal/subjects", "/portal/programs", "/portal/classes", "/portal/my-classes", "/portal/classroom"]) {
    revalidatePath(path, "layout");
  }
}

async function saveSubject(formData: FormData, mode: "create" | "edit"): Promise<SubjectFormState> {
  await requireSuperAdmin();
  const parsed = parseSubjectForm(formData, mode);
  if (!parsed.success) return parsed;
  const id = parsed.id;
  if (mode === "edit" && id === null) return missingSubjectError();
  let result: SubjectFormState;
  try {
    result = await prisma.$transaction(async (transaction): Promise<SubjectFormState> => {
      if (id !== null) {
        const subject = await transaction.subject.findUnique({ where: { id }, select: { id: true } });
        if (!subject) return missingSubjectError();
      }
      const duplicate = await duplicateSubjectError(transaction, parsed.data, id ?? undefined);
      if (duplicate) return duplicate;
      if (id === null) await transaction.subject.create({ data: parsed.data, select: { id: true } });
      else {
        await transaction.subject.update({ where: { id }, data: parsed.data, select: { id: true } });
        await transaction.class.updateMany({ where: { subjectId: id }, data: { subjectName: parsed.data.name } });
      }
      return { success: true, message: mode === "create" ? "Subject added successfully." : "Subject updated successfully." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { return saveSubjectError(error); }
  if (result.success) refreshSubjectPages();
  return result;
}

export async function createSubject(_previous: SubjectFormState, formData: FormData): Promise<SubjectFormState> {
  return saveSubject(formData, "create");
}

export async function updateSubject(_previous: SubjectFormState, formData: FormData): Promise<SubjectFormState> {
  return saveSubject(formData, "edit");
}

export async function getSubjects(): Promise<SubjectOverview[]> {
  await requireSuperAdmin();
  const subjects = await prisma.subject.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, code: true, units: true, _count: { select: { programSubjects: true, classes: true } } },
  });
  return subjects.map((subject) => ({
    id: subject.id.toString(), name: subject.name, code: subject.code, units: subject.units?.toString() ?? null,
    programCount: subject._count.programSubjects, classCount: subject._count.classes,
  }));
}

export async function getSubjectForEdit(subjectId: string) {
  await requireSuperAdmin();
  const id = parseSubjectId(subjectId);
  if (id === null) return null;
  const subject = await prisma.subject.findUnique({ where: { id }, select: { id: true, name: true, code: true, units: true } });
  return subject ? { id: subject.id.toString(), values: { name: subject.name, code: subject.code ?? "", units: subject.units?.toString() ?? "" } } : null;
}
