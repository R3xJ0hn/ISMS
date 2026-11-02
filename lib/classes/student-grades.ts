import { getStudentRecordReport } from "./student";
import { getClassCalendar } from "@/lib/academics/calendar";
import { getClassPeriodVisibility } from "./period-visibility";
import { getEmployeeFullName } from "@/lib/employees/names";
import { formatStudentName } from "@/lib/utils";
import type { ClassCalendar } from "@/lib/academics/calendar";
import type { ClassSummaryStudent } from "./spreadsheet";

export type StudentClassGrade = Pick<
  ClassSummaryStudent,
  "periodGrades" | "average" | "remarks" | "note"
> & {
  classId: string;
  classCode: string;
  subject: string;
  code: string | null;
  units: string | null;
  instructorName: string;
  sectionName: string;
  schoolYear: string;
  term: string;
  calendar: ClassCalendar;
  periodVisibility: Record<string, boolean>;
  availability: "available" | "hidden" | "not_connected" | "unavailable";
  message: string | null;
};
const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() || "";
export async function getStudentClassGrades({
  schoolYear,
  term,
}: { schoolYear?: string | string[]; term?: string | string[] } = {}) {
  let selectedYear = first(schoolYear),
    selectedTerm = first(term);
  const report = await getStudentRecordReport({
    choose: (rows) => {
      const years = [...new Set(rows.map((r) => r.schoolYear))]
        .sort()
        .reverse();
      selectedYear ||= years[0] ?? "";
      const matching = rows.filter((r) => r.schoolYear === selectedYear);
      selectedTerm ||= matching[0] ? String(matching[0].academicTermId) : "";
      return matching.filter((r) => String(r.academicTermId) === selectedTerm);
    },
  });
  const schoolYears = [...new Set(report.allClasses.map((r) => r.schoolYear))]
    .sort()
    .reverse();
  const terms = [
    ...new Map(
      report.allClasses
        .filter((r) => r.schoolYear === selectedYear)
        .map((r) => [
          String(r.academicTermId),
          {
            value: String(r.academicTermId),
            label: `${r.academicTerm.scheme.name} / ${r.academicTerm.name}`,
          },
        ]),
    ).values(),
  ];
  const grades: StudentClassGrade[] = report.classes.map(({ row, result }) => ({
    classId: String(row.id),
    classCode: row.classCode,
    subject: row.subject?.name ?? row.subjectName,
    code: row.subject?.code ?? null,
    units: row.subject?.units?.toString() ?? null,
    instructorName: getEmployeeFullName(row.teacher.employee),
    sectionName: row.sectionName,
    schoolYear: row.schoolYear,
    term: row.academicTerm.name,
    calendar: getClassCalendar(row),
    periodVisibility: getClassPeriodVisibility(row),
    ...(result.success
      ? {
          periodGrades: result.record.periodGrades,
          average: result.record.average,
          remarks: result.record.remarks,
          note: result.record.note,
        }
      : { periodGrades: {}, average: null, remarks: null, note: null }),
    availability: result.success
      ? "available"
      : !getClassCalendar(row).periods.some((p) => p.visible)
        ? "hidden"
        : !row.spreadsheetUrl
          ? "not_connected"
          : "unavailable",
    message: result.success ? null : result.message,
  }));
  return {
    student: report.student
      ? {
          name: formatStudentName(report.student),
          studentNumber: report.student.studentNumber,
        }
      : null,
    schoolYears,
    schoolYear: selectedYear || null,
    term: selectedTerm,
    terms,
    grades,
    message:
      report.message ??
      (!grades.length
        ? "No classes are assigned to you for this school year and term."
        : null),
  };
}
export type StudentClassGradesReport = Awaited<
  ReturnType<typeof getStudentClassGrades>
>;
