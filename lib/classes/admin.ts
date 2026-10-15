import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isAcademicLevelAllowedForProgram } from "@/lib/academic-levels";
import { revalidatePath } from "next/cache";
import { parseClassForm, type ClassFormState } from "./validation";

function missingClassError(): ClassFormState {
  return { success: false, message: "This class no longer exists.", fieldErrors: { classId: "Choose an existing class." } };
}

function missingTeacherError(): ClassFormState {
  return {
    success: false,
    message: "Choose a saved teacher with an active Teacher account.",
    fieldErrors: { teacherId: "This teacher profile is no longer available." },
  };
}

function duplicateClassError(): ClassFormState {
  return {
    success: false,
    message: "This teacher already has this class assignment.",
    fieldErrors: { subjectId: "This subject, program, section, year level, school year and branch are already assigned to this teacher." },
  };
}

function missingBranchError(): ClassFormState {
  return {
    success: false,
    message: "Choose an existing branch.",
    fieldErrors: { branchId: "This branch is no longer available." },
  };
}

function missingProgramError(): ClassFormState {
  return { success: false, message: "Choose a program offered by this branch.", fieldErrors: { programId: "This program is no longer offered by the selected branch." } };
}

function missingSubjectError(): ClassFormState {
  return { success: false, message: "Choose a subject assigned to this program.", fieldErrors: { subjectId: "This subject is no longer assigned to the selected program." } };
}

function saveClassError(error: unknown): ClassFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return duplicateClassError();
    if (error.code === "P2025") return missingClassError();
    if (error.code === "P2003") return { success: false, message: "The selected class assignment changed while saving. Check the teacher, branch, program and subject and try again." };
    if (error.code === "P2034") return { success: false, message: "Classes changed while saving. Please try again." };
  }
  console.error("Failed to save class.");
  return { success: false, message: "Unable to save the class. Please try again." };
}

function refreshClassPages(id: bigint) {
  for (const path of [
    "/portal/classes", `/portal/classes/${id}/edit`, "/portal/my-classes", `/portal/my-classes/${id}`,
  ]) revalidatePath(path);
}

async function saveClass(formData: FormData, mode: "create" | "edit"): Promise<ClassFormState> {
  await requireSuperAdmin();
  const parsed = parseClassForm(formData, mode);
  if (!parsed.success) return parsed;

  const id = parsed.id;
  if (mode === "edit" && id === undefined) return missingClassError();
  let savedId = id;
  let result: ClassFormState;
  try {
    result = await prisma.$transaction(async (transaction): Promise<ClassFormState> => {
      if (id !== undefined) {
        const existing = await transaction.class.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return missingClassError();
      }

      const teacher = await transaction.teacher.findFirst({
        where: { employeeId: parsed.data.teacherId, user: { role: UserRole.teacher, emailVerified: true } }, select: { employeeId: true },
      });
      if (!teacher) return missingTeacherError();
      const branch = await transaction.branch.findUnique({ where: { id: parsed.data.branchId }, select: { id: true } });
      if (!branch) return missingBranchError();
      const branchProgram = await transaction.branchProgram.findUnique({
        where: { branchId_programId: { branchId: parsed.data.branchId, programId: parsed.data.programId } }, select: { program: { select: { programType: true } } },
      });
      if (!branchProgram) return missingProgramError();
      if (!isAcademicLevelAllowedForProgram(branchProgram.program.programType, parsed.data.yearLevel)) return { success: false, message: "Choose a year level for the selected program.", fieldErrors: { yearLevel: "This year level is not available for the selected program." } };
      const programSubject = await transaction.programSubject.findUnique({
        where: { programId_subjectId: { programId: parsed.data.programId, subjectId: parsed.data.subjectId } },
        select: { subject: { select: { name: true } } },
      });
      if (!programSubject) return missingSubjectError();
      if (parsed.studentIds?.length && await transaction.student.count({ where: { id: { in: parsed.studentIds } } }) !== parsed.studentIds.length) {
        return { success: false, message: "Choose existing student records.", fieldErrors: { studentIds: "One or more selected students are no longer available." } };
      }

      const duplicate = await transaction.class.findFirst({
        where: {
          ...(id === undefined ? {} : { id: { not: id } }),
          teacherId: parsed.data.teacherId, schoolYear: parsed.data.schoolYear,
          sectionName: parsed.data.sectionName, yearLevel: parsed.data.yearLevel,
          programId: parsed.data.programId, subjectId: parsed.data.subjectId,
          branchId: parsed.data.branchId,
        },
        select: { id: true },
      });
      if (duplicate) return duplicateClassError();

      const data = { ...parsed.data, subjectName: programSubject.subject.name };
      if (id === undefined) {
        const created = await transaction.class.create({ data, select: { id: true } });
        savedId = created.id;
      } else {
        await transaction.class.update({ where: { id }, data, select: { id: true } });
      }
      const classId = savedId;
      if (classId !== undefined && parsed.studentIds !== undefined) {
        if (id !== undefined) await transaction.classStudent.deleteMany({ where: { classId } });
        if (parsed.studentIds.length) await transaction.classStudent.createMany({
          data: parsed.studentIds.map((studentId) => ({ classId, studentId })),
        });
      }
      return { success: true, message: mode === "create" ? "Class created successfully." : "Class updated successfully." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return saveClassError(error);
  }

  if (result.success && savedId !== undefined) refreshClassPages(savedId);
  return result;
}

export async function createClass(_previousState: ClassFormState, formData: FormData): Promise<ClassFormState> {
  return saveClass(formData, "create");
}

export async function updateClass(_previousState: ClassFormState, formData: FormData): Promise<ClassFormState> {
  return saveClass(formData, "edit");
}
