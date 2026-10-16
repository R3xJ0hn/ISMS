import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmployeeFullName } from "@/lib/employees/names";
import { formatStudentName } from "@/lib/utils";
import { getCurrentStudent, studentClassMembershipWhere } from "@/lib/portal/student";
import { getStudentClasswork, type ClassSummaryStudent, type ClassworkCatalogResult } from "./spreadsheet";
import { parseClassId } from "./validation";
import { getClassPeriodVisibility, classPeriodDefinitions, type ClassPeriodVisibility } from "./period-visibility";
import { classStudentPreviewSelection, serializeClassStudentPreviews } from "./student-preview";

const classSelection = {
  id: true,
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

function releasedGradeRecord(record: ClassSummaryStudent, visibility: ClassPeriodVisibility): ClassSummaryStudent {
  const allVisible = classPeriodDefinitions.every(({ field }) => visibility[field]);
  return {
    studentNumber: record.studentNumber,
    studentName: record.studentName,
    prelim: visibility.prelimVisible ? record.prelim : null,
    midterm: visibility.midtermVisible ? record.midterm : null,
    prefinals: visibility.prefinalsVisible ? record.prefinals : null,
    finals: visibility.finalsVisible ? record.finals : null,
    average: allVisible ? record.average : null,
    remarks: allVisible ? record.remarks : null,
    note: allVisible ? record.note : null,
  };
}

export async function getStudentClasses() {
  const student = await getCurrentStudent();
  if (!student) return [];
  const classes = await prisma.class.findMany({
    where: studentClassMembershipWhere(student.id),
    select: { ...classSelection, ...classStudentPreviewSelection },
    orderBy: [{ schoolYear: "desc" }, { subjectName: "asc" }, { sectionName: "asc" }],
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
      const recordMessages = {
        STUDENT_NUMBER_NOT_FOUND: "Your student number is not listed in this class spreadsheet. Ask your teacher to add or correct it.",
        STUDENT_REPORT_NOT_FOUND: "Your grade record is not available in this class spreadsheet yet. Ask your teacher to check the REPORT sheet.",
        STUDENT_RECORD_AMBIGUOUS: "Your spreadsheet records cannot be matched safely. Ask your teacher to correct duplicate student records.",
      };
      const message = records.code && Object.hasOwn(recordMessages, records.code) ? recordMessages[records.code] : hidden ? records.message : null;
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
        grades = { success: true, record: releasedGradeRecord(records.record, periodVisibility) };
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
