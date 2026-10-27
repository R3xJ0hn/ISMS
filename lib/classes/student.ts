import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmployeeFullName } from "@/lib/employees/names";
import { formatStudentName } from "@/lib/utils";
import { getCurrentStudent, studentClassMembershipWhere } from "@/lib/portal/student";
import { getStudentClasswork, type ClassSummaryStudent, type ClassworkCatalogResult } from "./spreadsheet";
import { getStudentSpreadsheetErrorMessage } from "./spreadsheet-errors";
import { parseClassId } from "./validation";
import { getClassPeriodVisibility, classPeriodDefinitions, getVisiblePeriodGrades } from "./period-visibility";
import { classStudentPreviewSelection, serializeClassStudentPreviews } from "./student-preview";
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
  teacher: { select: { employee: { select: {
    firstName: true, middleName: true, lastName: true, suffix: true,
  } } } },
} as const;

type SelectedClass = Prisma.ClassGetPayload<{ select: typeof classSelection }>;

function classroomMetadata(assignedClass: SelectedClass) {
  return {
    id: assignedClass.id.toString(),
    classCode: assignedClass.classCode,
    status: assignedClass.status,
    programId: assignedClass.programId?.toString() ?? null,
    programCode: assignedClass.program?.code ?? null,
    programLabel: assignedClass.program ? `${assignedClass.program.code} — ${assignedClass.program.label}` : null,
    schoolYear: assignedClass.schoolYear,
    semester: assignedClass.semester,
    sectionName: assignedClass.sectionName,
    yearLevel: assignedClass.yearLevel,
    subjectName: assignedClass.subjectName,
    branchTitle: assignedClass.branch?.title ?? null,
    teacherName: getEmployeeFullName(assignedClass.teacher.employee),
    spreadsheetLinked: Boolean(assignedClass.spreadsheetUrl),
  };
}

export async function getStudentClasses() {
  const student = await getCurrentStudent();
  if (!student) return [];
  const classes = await prisma.class.findMany({
    where: studentClassMembershipWhere(student.id),
    select: { ...classSelection, ...classStudentPreviewSelection },
    orderBy: classListOrderBy,
  });
  return classes.map((assignedClass) => ({
    ...classroomMetadata(assignedClass),
    studentPreviews: serializeClassStudentPreviews(assignedClass.students),
    studentCount: assignedClass._count.students,
  }));
}

export type StudentClassGrades =
  | { success: true; record: ClassSummaryStudent | null }
  | { success: false; message: string };

export async function getStudentClass(classId: string) {
  const student = await getCurrentStudent();
  const id = parseClassId(classId);
  if (!student || id === null) return null;
  let assignedClass = await prisma.class.findFirst({
    where: { id, ...studentClassMembershipWhere(student.id) },
    select: classSelection,
  });
  if (!assignedClass) return null;

  let periodVisibility = getClassPeriodVisibility(assignedClass);
  const anyPeriodVisible = classPeriodDefinitions.some(({ field }) => periodVisibility[field]);
  const studentNumber = student.studentNumber?.trim() || null;
  let grades: StudentClassGrades;
  let classwork: ClassworkCatalogResult;
  if (!anyPeriodVisible) {
    const message = "Your teacher has hidden all grading periods for this class.";
    grades = { success: false, message };
    classwork = { success: false, message };
  } else if (!studentNumber) {
    grades = { success: false, message: "Your student number is not available yet. Contact the registrar to see your class grades." };
    classwork = { success: false, message: "Your student number is not available yet. Contact the registrar to see your classwork." };
  } else if (!assignedClass.spreadsheetUrl) {
    grades = { success: false, message: "Your teacher has not connected the class grade summary yet." };
    classwork = { success: false, message: "Your teacher has not connected the class spreadsheet yet." };
  } else {
    // Fetch only this student's records; never request the teacher's full grade roster.
    const records = await getStudentClasswork(assignedClass.spreadsheetUrl, studentNumber);
    if (!records.success) {
      const hidden = records.message === "This class has not enabled spreadsheet records in the portal.";
      const message = getStudentSpreadsheetErrorMessage(records.code) ?? (hidden ? records.message : null);
      grades = { success: false, message: message ?? "Your class grades are unavailable right now. Ask your teacher to check the connected spreadsheet and your student number, then try again." };
      classwork = { success: false, message: message ?? "Your classwork is unavailable right now. Ask your teacher to check the connected spreadsheet and your student number, then try again." };
    } else {
      // A teacher may hide records or change the roster while the spreadsheet request is pending.
      assignedClass = await prisma.class.findFirst({
        where: { id, ...studentClassMembershipWhere(student.id) },
        select: classSelection,
      });
      if (!assignedClass) return null;
      periodVisibility = getClassPeriodVisibility(assignedClass);
      if (!classPeriodDefinitions.some(({ field }) => periodVisibility[field])) {
        const message = "Your teacher has hidden all grading periods for this class.";
        grades = { success: false, message };
        classwork = { success: false, message };
      // Student numbers are identifiers: preserve case and leading zeros, and never match by name.
      } else if (records.record.studentNumber.trim() !== studentNumber) {
        grades = { success: false, message: "Your class grades cannot be matched safely. Please contact your teacher." };
        classwork = { success: false, message: "Your classwork cannot be matched safely. Please contact your teacher." };
      } else {
        grades = { success: true, record: {
          studentNumber: records.record.studentNumber, studentName: records.record.studentName,
          ...getVisiblePeriodGrades(records.record, periodVisibility),
        } };
        classwork = { success: true, periods: records.periods.filter(({ period }) =>
          classPeriodDefinitions.some((definition) => definition.period === period && periodVisibility[definition.field])
        ) };
      }
    }
  }

  return {
    ...classroomMetadata(assignedClass),
    student: { name: formatStudentName(student), studentNumber },
    periodVisibility,
    grades,
    classwork,
  };
}
