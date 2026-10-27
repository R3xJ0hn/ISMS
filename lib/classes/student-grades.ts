import type { Prisma } from "@/lib/generated/prisma/client";
import type { Semester } from "@/lib/generated/prisma/enums";
import { getEmployeeFullName } from "@/lib/employees/names";
import { getCurrentStudent, studentClassMembershipWhere } from "@/lib/portal/student";
import { prisma } from "@/lib/prisma";
import { formatStudentName } from "@/lib/utils";
import { classPeriodDefinitions, getClassPeriodVisibility, getVisiblePeriodGrades, type ClassPeriodVisibility } from "./period-visibility";
import { getStudentClasswork, type ClassSummaryStudent, type StudentClassworkResult } from "./spreadsheet";
import { getStudentSpreadsheetErrorMessage } from "./spreadsheet-errors";
import { getSpreadsheetId, normalizeSpreadsheetUrl } from "./validation";

export type GradeSemester = "1stSem" | "2ndSem" | "unassigned";
type GradeFields = Pick<ClassSummaryStudent, "prelim" | "midterm" | "prefinals" | "finals" | "average" | "remarks" | "note">;
export type StudentClassGrade = GradeFields & {
  classId: string;
  classCode: string;
  subject: string;
  code: string | null;
  units: string | null;
  instructorName: string;
  sectionName: string;
  schoolYear: string;
  semester: Semester | null;
  periodVisibility: ClassPeriodVisibility;
  availability: "available" | "hidden" | "not_connected" | "unavailable";
  message: string | null;
};
export type StudentClassGradesReport = {
  student: { name: string; studentNumber: string | null } | null;
  schoolYears: string[];
  schoolYear: string | null;
  semester: GradeSemester;
  hasUnassignedSemester: boolean;
  grades: readonly StudentClassGrade[];
  message: string | null;
};

const classSelection = {
  id: true, classCode: true, subjectName: true, sectionName: true, schoolYear: true, semester: true,
  spreadsheetUrl: true, prelimVisible: true, midtermVisible: true, prefinalsVisible: true, finalsVisible: true,
  subject: { select: { code: true, name: true, units: true } },
  teacher: { select: { employee: { select: { firstName: true, middleName: true, lastName: true, suffix: true } } } },
} satisfies Prisma.ClassSelect;
type AssignedClass = Prisma.ClassGetPayload<{ select: typeof classSelection }>;
const emptyGrades: GradeFields = { prelim: null, midterm: null, prefinals: null, finals: null, average: null, remarks: null, note: null };
const unavailableMessage = "Your class grades are unavailable right now. Ask your teacher to check the connected spreadsheet and your student number, then try again.";
const changedMessage = "Your student record changed while grades were loading. Refresh the page to view your current grades.";

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function normalizeSemester(value: string | string[] | undefined): GradeSemester {
  const semester = firstValue(value);
  return semester === "2" || semester === "2ndSem" ? "2ndSem" : semester === "unassigned" ? "unassigned" : "1stSem";
}

function assignedYears(classes: readonly AssignedClass[]) {
  return [...new Set(classes.map((row) => row.schoolYear))].sort((left, right) => right.localeCompare(left, "en", { numeric: true }));
}

function selectedClasses(classes: readonly AssignedClass[], schoolYear: string | null, semester: GradeSemester) {
  const term = semester === "1stSem" ? "FirstSemester" : semester === "2ndSem" ? "SecondSemester" : null;
  return classes.filter((row) => row.schoolYear === schoolYear && row.semester === term);
}

function loadAssignedClasses(studentId: bigint) {
  return prisma.class.findMany({
    where: studentClassMembershipWhere(studentId), select: classSelection,
    orderBy: [{ schoolYear: "desc" }, { subjectName: "asc" }, { sectionName: "asc" }, { classCode: "asc" }, { id: "asc" }],
  });
}

function requestKey(row: AssignedClass, studentNumber: string | null) {
  const sheetId = row.spreadsheetUrl && getSpreadsheetId(row.spreadsheetUrl);
  return sheetId && studentNumber ? JSON.stringify([sheetId, studentNumber]) : null;
}

/** Resolve enrollment and identity from the verified session; spreadsheet data never selects report rows. */
export async function getStudentClassGrades({ schoolYear: yearInput, semester: semesterInput }: {
  schoolYear?: string | string[]; semester?: string | string[];
} = {}): Promise<StudentClassGradesReport> {
  let student = await getCurrentStudent();
  const report: StudentClassGradesReport = {
    student: null, schoolYears: [], schoolYear: firstValue(yearInput) || null,
    semester: normalizeSemester(semesterInput), hasUnassignedSemester: false, grades: [], message: null,
  };
  if (!student) return { ...report, message: "Your student record is not available. Contact the registrar to view your grades." };
  const studentId = student.id;
  const studentNumber = student.studentNumber?.trim() || null;
  let classes = await loadAssignedClasses(studentId);
  const years = assignedYears(classes);
  report.schoolYear ??= years[0] ?? null;
  const yearClasses = classes.filter((row) => row.schoolYear === report.schoolYear);
  if (!firstValue(semesterInput)) {
    report.semester = yearClasses.some((row) => row.semester === "FirstSemester") ? "1stSem"
      : yearClasses.some((row) => row.semester === "SecondSemester") ? "2ndSem"
      : yearClasses.some((row) => row.semester === null) ? "unassigned" : "1stSem";
  }
  const initialClasses = selectedClasses(classes, report.schoolYear, report.semester);
  const initialById = new Map(initialClasses.map((row) => [row.id, row]));
  const requests = new Map<string, string>();
  for (const row of initialClasses) {
    const key = requestKey(row, studentNumber);
    if (key && classPeriodDefinitions.some(({ field }) => getClassPeriodVisibility(row)[field]) && !requests.has(key)) {
      requests.set(key, row.spreadsheetUrl!);
    }
  }
  const results = new Map<string, StudentClassworkResult>();
  const pending = [...requests.entries()];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, pending.length) }, async () => {
    while (next < pending.length) {
      const [key, url] = pending[next++];
      try { results.set(key, await getStudentClasswork(url, studentNumber!)); }
      catch { results.set(key, { success: false, message: unavailableMessage }); }
    }
  }));
  if (requests.size) {
    const currentStudent = await getCurrentStudent();
    if (!currentStudent || currentStudent.id !== studentId || (currentStudent.studentNumber?.trim() || null) !== studentNumber) {
      return { ...report, message: changedMessage };
    }
    student = currentStudent;
    classes = await loadAssignedClasses(studentId);
  }
  report.student = { name: formatStudentName(student), studentNumber };
  report.schoolYears = assignedYears(classes);
  report.hasUnassignedSemester = classes.some((row) => row.schoolYear === report.schoolYear && row.semester === null);
  report.grades = selectedClasses(classes, report.schoolYear, report.semester).map((row): StudentClassGrade => {
    const periodVisibility = getClassPeriodVisibility(row);
    const grade: StudentClassGrade = {
      classId: row.id.toString(), classCode: row.classCode, subject: row.subject?.name ?? row.subjectName,
      code: row.subject?.code ?? null, units: row.subject?.units?.toString() ?? null,
      instructorName: getEmployeeFullName(row.teacher.employee), sectionName: row.sectionName,
      schoolYear: row.schoolYear, semester: row.semester, periodVisibility,
      ...emptyGrades, availability: "unavailable", message: unavailableMessage,
    };
    if (!classPeriodDefinitions.some(({ field }) => periodVisibility[field])) {
      return { ...grade, availability: "hidden", message: "Your teacher has hidden all grading periods for this class." };
    }
    if (!row.spreadsheetUrl?.trim()) return { ...grade, availability: "not_connected", message: "Your teacher has not connected this class spreadsheet yet." };
    if (!studentNumber) return { ...grade, message: "Your student number is not available yet. Contact the registrar to see your grades." };
    const initial = initialById.get(row.id);
    if (!initial || normalizeSpreadsheetUrl(initial.spreadsheetUrl ?? "") !== normalizeSpreadsheetUrl(row.spreadsheetUrl)) {
      return { ...grade, message: "Your class spreadsheet changed while grades were loading. Refresh the page to view its current records." };
    }
    const key = requestKey(row, studentNumber);
    const result = key ? results.get(key) : null;
    if (!result) return grade;
    if (!result.success) return {
      ...grade, availability: result.code === "RECORDS_DISABLED" ? "hidden" : "unavailable",
      message: getStudentSpreadsheetErrorMessage(result.code) ?? unavailableMessage,
    };
    if (result.record.studentNumber.trim() !== studentNumber) return {
      ...grade, message: "Your class grades cannot be matched safely. Please contact your teacher.",
    };
    return { ...grade, ...getVisiblePeriodGrades(result.record, periodVisibility), availability: "available", message: null };
  });
  if (!report.grades.length) report.message = "No classes are assigned to you for this school year and semester.";
  return report;
}
