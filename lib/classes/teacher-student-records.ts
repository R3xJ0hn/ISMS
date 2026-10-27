import "server-only";

import { formatStudentName } from "@/lib/utils";
import { getAssignedClass } from "./teacher";
import { getStudentClasswork, type ClassworkCatalogResult } from "./spreadsheet";
import { getSpreadsheetErrorMessage } from "./spreadsheet-errors";
import { normalizeSpreadsheetUrl, parseClassId } from "./validation";

type AssignedClass = NonNullable<Awaited<ReturnType<typeof getAssignedClass>>>;
type EnrolledStudent = AssignedClass["students"][number]["student"];

function studentRecords(assignedClass: AssignedClass, student: EnrolledStudent, classwork: ClassworkCatalogResult) {
  return {
    classId: assignedClass.id.toString(), classCode: assignedClass.classCode, subjectName: assignedClass.subjectName,
    student: { id: student.id.toString(), name: formatStudentName(student), studentNumber: student.studentNumber?.trim() || null, imageUrl: student.userImage },
    classwork,
  };
}

function enrolledStudent(assignedClass: AssignedClass, studentId: bigint) {
  return assignedClass.students.find(({ student }) => student.id === studentId)?.student;
}

function uniqueNumber(assignedClass: AssignedClass, studentId: bigint, number: string) {
  return assignedClass.students.every(({ student }) => student.id === studentId || student.studentNumber?.trim() !== number);
}

/** Teacher access is scoped to a current class assignment and an unambiguous enrolled student. */
export async function getTeacherStudentRecords(classId: string, studentId: string) {
  const assignedClass = await getAssignedClass(classId);
  const id = parseClassId(studentId, { canonical: true });
  if (!assignedClass || id === null) return null;
  const student = enrolledStudent(assignedClass, id);
  if (!student) return null;
  const number = student.studentNumber?.trim() || null;
  let classwork: ClassworkCatalogResult;
  if (!number) {
    classwork = { success: false, message: "This student does not have a student number. Ask the administrator to update their record." };
  } else if (!uniqueNumber(assignedClass, id, number)) {
    classwork = { success: false, message: "Multiple enrolled students share this student number. Ask the administrator to correct their records before viewing activities." };
  } else if (!assignedClass.spreadsheetUrl) {
    classwork = { success: false, message: "Connect the class spreadsheet in Overview to view this student's activities." };
  } else {
    const unavailable = "Unable to load this student's activity records. Check the class spreadsheet and student number, then try again.";
    const result = await getStudentClasswork(assignedClass.spreadsheetUrl, number).catch(() => ({ success: false as const, message: unavailable }));
    // Assignment, enrollment, number and link can change while Google Sheets responds.
    const current = await getAssignedClass(classId);
    if (!current) return null;
    const currentStudent = enrolledStudent(current, id);
    if (!currentStudent) return null;
    if (currentStudent.studentNumber?.trim() !== number || !uniqueNumber(current, id, number) ||
      normalizeSpreadsheetUrl(current.spreadsheetUrl ?? "") !== normalizeSpreadsheetUrl(assignedClass.spreadsheetUrl)) {
      return studentRecords(current, currentStudent, { success: false, message: "The class or student record changed while activities were loading. Refresh to view current records." });
    }
    classwork = !result.success ? { success: false, message: getSpreadsheetErrorMessage("code" in result ? result.code : undefined) ?? unavailable }
      : result.record.studentNumber.trim() !== number ? { success: false, message: "The spreadsheet returned a different student record. Check the student numbers in INPUT and REPORT." }
      : { success: true, periods: result.periods };
    return studentRecords(current, currentStudent, classwork);
  }
  return studentRecords(assignedClass, student, classwork);
}
