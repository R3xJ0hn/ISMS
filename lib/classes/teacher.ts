import { requireTeacher } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeSpreadsheetUrl, parseClassId, parseTeacherSpreadsheetForm, parseTeacherSpreadsheetRemovalForm, type TeacherSpreadsheetFormState, type TeacherSpreadsheetRemovalFormState } from "./validation";
import { parseClassPeriodVisibilityForm, type ClassPeriodVisibilityFormState } from "./period-visibility";
import { classStudentPreviewSelection } from "./student-preview";
import { classListOrderBy } from "./grouping";

const classSelection = {
  id: true,
  classCode: true,
  status: true,
  programId: true,
  program: { select: { code: true, label: true } },
  schoolYear: true,
  semester: true,
  sectionName: true,
  yearLevel: true,
  subjectName: true,
  spreadsheetUrl: true,
  prelimVisible: true,
  midtermVisible: true,
  prefinalsVisible: true,
  finalsVisible: true,
  branch: { select: { title: true } },
} as const;

const rosterSelection = {
  students: {
    orderBy: { student: { lastName: "asc" as const } },
    select: { student: { select: { id: true, studentNumber: true, firstName: true, middleName: true, lastName: true, suffix: true, userImage: true } } },
  },
} as const;

async function currentTeacher() {
  const session = await requireTeacher();
  const id = parseClassId(session.id);
  if (id === null) redirect("/login");
  const teacher = await prisma.teacher.findUnique({ where: { userId: id }, select: { employeeId: true } });
  return teacher ? { employeeId: teacher.employeeId, userId: id } : null;
}

function assignmentWhere(teacher: { employeeId: bigint; userId: bigint }) {
  return { teacherId: teacher.employeeId, teacher: { userId: teacher.userId, user: { role: "teacher" as const } } };
}

function refreshClassSpreadsheetViews(id: bigint) {
  for (const path of [
    "/portal/my-classes", `/portal/my-classes/${id}`, "/portal/classes", `/portal/classes/${id}`,
    `/portal/classes/${id}/edit`, "/portal/classroom", `/portal/classroom/${id}`, "/portal/grades", "/portal/dashboard",
  ]) revalidatePath(path);
}

export async function getAssignedClasses() {
  const teacher = await currentTeacher();
  if (!teacher) return [];
  return prisma.class.findMany({
    where: assignmentWhere(teacher),
    select: { ...classSelection, ...classStudentPreviewSelection },
    orderBy: classListOrderBy,
  });
}

export async function getAssignedClass(classId: string) {
  const teacher = await currentTeacher();
  const id = parseClassId(classId);
  if (!teacher || id === null) return null;
  return prisma.class.findFirst({
    where: { id, ...assignmentWhere(teacher) },
    select: { ...classSelection, ...rosterSelection },
  });
}

export async function updateClassSpreadsheet(
  _previousState: TeacherSpreadsheetFormState,
  formData: FormData,
): Promise<TeacherSpreadsheetFormState> {
  const teacher = await currentTeacher();
  const parsed = parseTeacherSpreadsheetForm(formData);
  if (!parsed.success) return parsed;
  if (!teacher) return { success: false, message: "Your account has no linked teacher profile. Contact your administrator." };

  let updated: { count: number };
  try {
    updated = await prisma.class.updateMany({
      where: { id: parsed.id, ...assignmentWhere(teacher) },
      data: { spreadsheetUrl: parsed.spreadsheetUrl },
    });
  } catch {
    console.error("Failed to save class spreadsheet link.");
    return { success: false, message: "Unable to save the spreadsheet link. Please try again." };
  }
  if (updated.count !== 1) {
    return {
      success: false,
      message: "This class is no longer available to your account.",
      fieldErrors: { classId: "Choose a class assigned to your account." },
    };
  }

  refreshClassSpreadsheetViews(parsed.id);
  return { success: true, message: "Spreadsheet link saved successfully." };
}

export async function removeClassSpreadsheet(
  _previousState: TeacherSpreadsheetRemovalFormState,
  formData: FormData,
): Promise<TeacherSpreadsheetRemovalFormState> {
  const teacher = await currentTeacher();
  if (!teacher) return { success: false, message: "Your account has no linked teacher profile. Contact your administrator." };
  const parsed = parseTeacherSpreadsheetRemovalForm(formData);
  if (!parsed.success) return parsed;

  try {
    const assignedClass = await prisma.class.findFirst({
      where: { id: parsed.id, ...assignmentWhere(teacher) },
      select: { classCode: true, spreadsheetUrl: true },
    });
    if (!assignedClass) return {
      success: false, message: "This class is no longer available to your account.",
      fieldErrors: { classId: "Choose a class assigned to your account." },
    };
    if (parsed.confirmation !== `${assignedClass.classCode}/remove-link`) return {
      success: false, message: "Type the confirmation exactly as shown.",
      fieldErrors: { confirmation: "Type the confirmation exactly as shown." },
    };
    if (!assignedClass.spreadsheetUrl || normalizeSpreadsheetUrl(assignedClass.spreadsheetUrl) !== parsed.expectedSpreadsheetUrl) return {
      success: false, message: "The spreadsheet link changed. Reload the class before removing it.",
      fieldErrors: { expectedSpreadsheetUrl: "Reload the class to confirm its current spreadsheet link." },
    };
    const removed = await prisma.class.updateMany({
      where: { id: parsed.id, ...assignmentWhere(teacher), classCode: assignedClass.classCode, spreadsheetUrl: assignedClass.spreadsheetUrl },
      data: { spreadsheetUrl: null },
    });
    if (removed.count !== 1) return {
      success: false, message: "The class or spreadsheet link changed. Reload the class and try again.",
      fieldErrors: { expectedSpreadsheetUrl: "Reload the class to confirm its current spreadsheet link." },
    };
  } catch {
    console.error("Failed to remove class spreadsheet link.");
    return { success: false, message: "Unable to remove the spreadsheet link. Please try again." };
  }
  refreshClassSpreadsheetViews(parsed.id);
  return { success: true, message: "Spreadsheet link removed successfully." };
}

export async function updateClassPeriodVisibility(
  _previousState: ClassPeriodVisibilityFormState,
  formData: FormData,
): Promise<ClassPeriodVisibilityFormState> {
  const teacher = await currentTeacher();
  const parsed = parseClassPeriodVisibilityForm(formData);
  if (!parsed.success) return parsed;
  if (!teacher) return { success: false, message: "Your account has no linked teacher profile. Contact your administrator." };

  let updated: { count: number };
  try {
    // Check the current assignment in the write itself. Updating one field lets
    // independently saved periods retain their values, even across browser tabs.
    updated = await prisma.class.updateMany({
      where: { id: parsed.id, ...assignmentWhere(teacher) },
      data: { [parsed.field]: parsed.visible },
    });
  } catch {
    console.error("Failed to save class grading period visibility.");
    return { success: false, message: "Unable to save grading period visibility. Please try again." };
  }
  if (updated.count !== 1) {
    return {
      success: false,
      message: "This class is no longer available to your account.",
      fieldErrors: { classId: "Choose a class assigned to your account." },
    };
  }

  for (const path of [
    "/portal/my-classes", `/portal/my-classes/${parsed.id}`, "/portal/classes",
    "/portal/classroom", `/portal/classroom/${parsed.id}`,
    "/portal/grades",
  ]) {
    revalidatePath(path);
  }
  return {
    success: true,
    message: `${parsed.period} records are now ${parsed.visible ? "visible to" : "hidden from"} students.`,
    period: parsed.period,
    visible: parsed.visible,
  };
}
