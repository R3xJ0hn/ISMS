import { getEmployeeFullName } from "@/lib/employees/names";
import { formatStudentName } from "@/lib/utils";
import {
  classStudentPreviewSelection,
  serializeClassStudentPreviews,
} from "./student-preview";
import "server-only";
import {
  academicSelection,
  getClassCalendar,
  calendarVersion,
} from "@/lib/academics/calendar";
import { prisma } from "@/lib/prisma";
import {
  getCurrentStudent,
  studentClassMembershipWhere,
} from "@/lib/portal/student";
import { classListOrderBy } from "./grouping";
import {
  getStudentClasswork,
  type ClassSummaryStudent,
  type StudentClassworkResult,
} from "./spreadsheet";
import {
  getSpreadsheetId,
  normalizeSpreadsheetUrl,
  parseClassId,
} from "./validation";
import {
  getClassPeriodVisibility,
  getVisiblePeriodGrades,
} from "./period-visibility";
import { getStudentSpreadsheetErrorMessage } from "./spreadsheet-errors";
import type { Prisma } from "@/lib/generated/prisma/client";

export const studentClassSelection = {
  id: true,
  classCode: true,
  status: true,
  subjectName: true,
  sectionName: true,
  schoolYear: true,
  yearLevel: true,
  programId: true,
  spreadsheetUrl: true,
  ...academicSelection,
  program: { select: { code: true, label: true } },
  branch: { select: { title: true } },
  subject: { select: { name: true, code: true, units: true } },
  teacher: {
    select: {
      employee: {
        select: {
          firstName: true,
          middleName: true,
          lastName: true,
          suffix: true,
        },
      },
    },
  },
} satisfies Prisma.ClassSelect;
export type StudentAssignedClass = Prisma.ClassGetPayload<{
  select: typeof studentClassSelection;
}>;
const unavailable =
  "Your class records are unavailable right now. Ask your teacher to check the spreadsheet and your student number, then try again.";

/** One bounded loader for Grades, Classwork and To-dos. Revalidate identity and enrollment after remote reads. */
export async function getStudentRecordReport(
  options: {
    classId?: bigint;
    ongoing?: boolean;
    choose?: (rows: StudentAssignedClass[]) => StudentAssignedClass[];
  } = {},
) {
  let student = await getCurrentStudent();
  if (!student)
    return {
      student: null,
      allClasses: [] as StudentAssignedClass[],
      classes: [] as {
        row: StudentAssignedClass;
        result: StudentClassworkResult;
      }[],
      message: "Your student record is not available. Contact the registrar.",
    };
  const id = student.id,
    number = student.studentNumber?.trim() || null;
  const load = () =>
    prisma.class.findMany({
      where: {
        ...studentClassMembershipWhere(id),
        ...(options.classId ? { id: options.classId } : {}),
        ...(options.ongoing ? { status: "ongoing" as const } : {}),
      },
      select: studentClassSelection,
      orderBy: classListOrderBy,
    });
  let allClasses = await load();
  const choose = options.choose ?? ((rows) => rows);
  const initial = new Map(
    choose(allClasses).map((row) => [String(row.id), row]),
  );
  const key = (row: StudentAssignedClass) =>
    number && row.spreadsheetUrl && getSpreadsheetId(row.spreadsheetUrl)
      ? JSON.stringify([
          getSpreadsheetId(row.spreadsheetUrl),
          number,
          calendarVersion(getClassCalendar(row)),
        ])
      : null;
  const requests = new Map<string, StudentAssignedClass>();
  for (const row of initial.values()) {
    const id = key(row);
    if (id && getClassCalendar(row).periods.some((p) => p.visible))
      requests.set(id, row);
  }
  const pending = [...requests],
    results = new Map<string, StudentClassworkResult>();
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, pending.length) }, async () => {
      while (next < pending.length) {
        const [id, row] = pending[next++];
        try {
          results.set(
            id,
            await getStudentClasswork(
              row.spreadsheetUrl!,
              number!,
              getClassCalendar(row),
            ),
          );
        } catch {
          results.set(id, { success: false, message: unavailable });
        }
      }
    }),
  );
  if (requests.size) {
    const current = await getCurrentStudent();
    if (
      !current ||
      current.id !== id ||
      (current.studentNumber?.trim() || null) !== number
    )
      return {
        student: null,
        allClasses: [],
        classes: [],
        message:
          "Your student record changed while records were loading. Refresh the page.",
      };
    student = current;
    allClasses = await load();
  }
  const classes = choose(allClasses).map((row) => {
    const calendar = getClassCalendar(row),
      original = initial.get(String(row.id));
    let result: StudentClassworkResult;
    if (!calendar.periods.some((p) => p.visible))
      result = {
        success: false,
        message: "Your teacher has hidden all grading periods for this class.",
      };
    else if (!row.spreadsheetUrl)
      result = {
        success: false,
        message: "Your teacher has not connected this class spreadsheet yet.",
      };
    else if (!number)
      result = {
        success: false,
        message:
          "Your student number is not available yet. Contact the registrar.",
      };
    else if (
      !original ||
      calendarVersion(getClassCalendar(original)) !==
        calendarVersion(calendar) ||
      normalizeSpreadsheetUrl(original.spreadsheetUrl ?? "") !==
        normalizeSpreadsheetUrl(row.spreadsheetUrl)
    )
      result = {
        success: false,
        message:
          "The class changed while records were loading. Refresh the page.",
      };
    else {
      const response = results.get(key(row) ?? "");
      if (!response) result = { success: false, message: unavailable };
      else if (!response.success)
        result = {
          success: false,
          message:
            getStudentSpreadsheetErrorMessage(response.code) ?? unavailable,
          ...(response.code ? { code: response.code } : {}),
        };
      else if (response.record.studentNumber.trim() !== number)
        result = {
          success: false,
          message:
            "Your spreadsheet record cannot be matched safely. Contact your teacher.",
        };
      else {
        const visibility = Object.fromEntries(
          calendar.periods.map((p) => [p.key, p.visible]),
        );
        result = {
          success: true,
          record: {
            studentNumber: response.record.studentNumber,
            studentName: response.record.studentName,
            periods: calendar.periods.map(({ key, name }) => ({ key, name })),
            ...getVisiblePeriodGrades(response.record, visibility),
          },
          periods: response.periods.filter((p) => visibility[p.key]),
        };
      }
    }
    return { row, result };
  });
  return { student, allClasses, classes, message: null };
}

function classroomMetadata(row: StudentAssignedClass) {
  return {
    id: String(row.id),
    classCode: row.classCode,
    status: row.status,
    programId: row.programId ? String(row.programId) : null,
    programCode: row.program?.code ?? null,
    programLabel: row.program?.label ?? null,
    schoolYear: row.schoolYear,
    term: row.academicTerm.name,
    termId: String(row.academicTermId),
    termPosition: row.academicTerm.position,
    sectionName: row.sectionName,
    yearLevel: row.yearLevel,
    subjectName: row.subjectName,
    branchTitle: row.branch?.title ?? null,
    teacherName: getEmployeeFullName(row.teacher.employee),
    spreadsheetLinked: Boolean(row.spreadsheetUrl),
  };
}
export async function getStudentClasses() {
  const student = await getCurrentStudent();
  if (!student) return [];
  const rows = await prisma.class.findMany({
    where: studentClassMembershipWhere(student.id),
    select: { ...studentClassSelection, ...classStudentPreviewSelection },
    orderBy: classListOrderBy,
  });
  return rows.map((row) => ({
    ...classroomMetadata(row),
    studentPreviews: serializeClassStudentPreviews(row.students),
    studentCount: row._count.students,
  }));
}
export type StudentClassGrades =
  | { success: true; record: ClassSummaryStudent | null }
  | { success: false; message: string };
export async function getStudentClass(classId: string) {
  const id = parseClassId(classId);
  if (!id) return null;
  const report = await getStudentRecordReport({ classId: id });
  const entry = report.classes[0];
  if (!entry || !report.student) return null;
  const { row, result } = entry;
  return {
    ...classroomMetadata(row),
    student: {
      name: formatStudentName(report.student),
      studentNumber: report.student.studentNumber,
    },
    calendar: getClassCalendar(row),
    periodVisibility: getClassPeriodVisibility(row),
    grades: result.success
      ? { success: true as const, record: result.record }
      : result,
    classwork: result.success
      ? { success: true as const, periods: result.periods }
      : result,
  };
}
