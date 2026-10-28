import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentStudent, studentClassMembershipWhere } from "@/lib/portal/student";
import { classListOrderBy } from "./grouping";
import { classPeriodDefinitions, getClassPeriodVisibility } from "./period-visibility";
import { getStudentClasswork, type ClassworkCatalogResult, type ClassworkPeriod, type StudentClassworkResult } from "./spreadsheet";
import { isAdditionalPointsActivity } from "./presentation";
import { getStudentSpreadsheetErrorMessage } from "./spreadsheet-errors";
import { getSpreadsheetId, normalizeSpreadsheetUrl } from "./validation";

const todoClassSelection = {
  id: true, classCode: true, subjectName: true, sectionName: true, schoolYear: true, semester: true,
  spreadsheetUrl: true, prelimVisible: true, midtermVisible: true, prefinalsVisible: true, finalsVisible: true,
} satisfies Prisma.ClassSelect;
type TodoClass = Prisma.ClassGetPayload<{ select: typeof todoClassSelection }>;

function ongoingClasses(studentId: bigint) {
  return prisma.class.findMany({
    where: { ...studentClassMembershipWhere(studentId), status: "ongoing" },
    select: todoClassSelection, orderBy: classListOrderBy,
  });
}

function anyPeriodVisible(row: TodoClass) {
  const visibility = getClassPeriodVisibility(row);
  return classPeriodDefinitions.some(({ field }) => visibility[field]);
}

function requestKey(row: TodoClass, studentNumber: string | null) {
  const sheetId = row.spreadsheetUrl && getSpreadsheetId(row.spreadsheetUrl);
  return sheetId && studentNumber ? JSON.stringify([sheetId, studentNumber]) : null;
}

function ungradedPeriods(periods: ClassworkPeriod[]): ClassworkPeriod[] {
  return periods.map((period) => ({ ...period, categories: period.categories.map((category) => ({
    ...category, activities: category.activities.filter((activity) =>
      !activity.isAdditionalPoints && !isAdditionalPointsActivity(activity.name) &&
      (activity.score == null || activity.score.trim() === "")),
  })).filter(({ activities }) => activities.length > 0) })).filter(({ categories }) => categories.length > 0);
}

export type StudentTodoClass = {
  id: string;
  classCode: string;
  subjectName: string;
  sectionName: string;
  schoolYear: string;
  semester: TodoClass["semester"];
  classwork: ClassworkCatalogResult;
};
export type StudentTodosReport = { classes: StudentTodoClass[]; message: string | null };

/** Only ungraded activities from the verified student's ongoing enrollments are returned. */
export async function getStudentTodos(): Promise<StudentTodosReport> {
  const student = await getCurrentStudent();
  if (!student) return { classes: [], message: "Your student record is not available. Contact the registrar to view your classwork." };
  const studentId = student.id;
  const number = student.studentNumber?.trim() || null;
  let classes = await ongoingClasses(studentId);
  const initialClasses = new Map(classes.map((row) => [row.id, row]));
  const requests = new Map<string, string>();
  for (const row of classes) {
    const key = requestKey(row, number);
    if (key && anyPeriodVisible(row) && !requests.has(key)) requests.set(key, row.spreadsheetUrl!);
  }
  const unavailable = "Your classwork is unavailable right now. Ask your teacher to check the connected spreadsheet and your student number, then try again.";
  const results = new Map<string, StudentClassworkResult>();
  const pending = [...requests.entries()];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
    while (next < pending.length) {
      const [key, url] = pending[next++];
      try { results.set(key, await getStudentClasswork(url, number!)); }
      catch { results.set(key, { success: false, message: unavailable }); }
    }
  }));
  if (requests.size) {
    const current = await getCurrentStudent();
    if (!current || current.id !== studentId || (current.studentNumber?.trim() || null) !== number) {
      return { classes: [], message: "Your student record changed while classwork was loading. Refresh To-dos to view your current records." };
    }
    classes = await ongoingClasses(studentId);
  }

  return { message: null, classes: classes.map((row): StudentTodoClass => {
    let classwork: ClassworkCatalogResult;
    const initial = initialClasses.get(row.id);
    const key = requestKey(row, number);
    const result = key ? results.get(key) : null;
    if (!anyPeriodVisible(row)) {
      classwork = { success: false, message: "Your teacher has hidden all grading periods for this class." };
    } else if (!row.spreadsheetUrl?.trim()) {
      classwork = { success: false, message: "Your teacher has not connected this class spreadsheet yet." };
    } else if (!number) {
      classwork = { success: false, message: "Your student number is not available yet. Contact the registrar to view your classwork." };
    } else if (!initial || normalizeSpreadsheetUrl(initial.spreadsheetUrl ?? "") !== normalizeSpreadsheetUrl(row.spreadsheetUrl)) {
      classwork = { success: false, message: "This class changed while classwork was loading. Refresh To-dos to view its current records." };
    } else if (!result) {
      classwork = { success: false, message: unavailable };
    } else if (!result.success) {
      classwork = { success: false, message: getStudentSpreadsheetErrorMessage(result.code) ?? unavailable };
    } else if (result.record.studentNumber.trim() !== number) {
      classwork = { success: false, message: "Your classwork cannot be matched safely. Please contact your teacher." };
    } else {
      const visibility = getClassPeriodVisibility(row);
      classwork = { success: true, periods: ungradedPeriods(result.periods.filter(({ period }) =>
        classPeriodDefinitions.some((definition) => definition.period === period && visibility[definition.field]))) };
    }
    return {
      id: row.id.toString(), classCode: row.classCode, subjectName: row.subjectName,
      sectionName: row.sectionName, schoolYear: row.schoolYear, semester: row.semester, classwork,
    };
  }) };
}
