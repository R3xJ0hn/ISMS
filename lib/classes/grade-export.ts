import * as XLSX from "xlsx";
import type { ClassStudentGrades } from "./enrolled-grades";

export type ClassGradeExportStudent = {
  id: string;
  name: string;
  studentNumber: string | null;
  grades: ClassStudentGrades | null;
};

export type ClassGradeExportDetails = {
  classCode: string;
  subjectName: string;
  schoolYear: string;
  semester: string;
  program: string;
  yearLevel: string;
  sectionName: string;
  branch: string;
  teacher: string;
  gradeAvailability: string;
};

function textCell(value: string | null): XLSX.CellObject {
  // Explicit string cells preserve identifiers and never create formulas or links.
  return { t: "s", v: value ?? "", z: "@" };
}

function gradeCell(value: string | null): XLSX.CellObject {
  if (value === null || !value.trim()) return textCell(null);
  const trimmed = value.trim();
  // Keep signed/formula-like text and unsupported formats exactly as supplied.
  if (!/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/u.test(trimmed)) return textCell(value);
  const normalized = trimmed.replace(/,/gu, "");
  const significantDigits = normalized.replace(".", "").replace(/^0+/u, "").replace(/0+$/u, "");
  const number = Number(normalized);
  // Excel stores 15 significant decimal digits; avoid silently rounding long values.
  if (!Number.isFinite(number) || number > Number.MAX_SAFE_INTEGER || significantDigits.length > 15 ||
    (number === 0 && /[1-9]/u.test(normalized))) return textCell(value);
  return { t: "n", v: number };
}

/** Export every supplied enrolled student; callers control the authorized class data. */
export function createClassGradesWorkbook(
  details: ClassGradeExportDetails,
  students: readonly ClassGradeExportStudent[],
): XLSX.WorkBook {
  const headers = ["Student number", "Student name", "Prelim", "Midterm", "Prefinals", "Finals", "Final average", "Remarks", "Note", "Grade record status"];
  const rows = students.map((student) => {
    const grades = student.grades;
    const status = grades ? "Available" : details.gradeAvailability === "Available" ? "No matching grade record" : details.gradeAvailability;
    return [
      textCell(student.studentNumber), textCell(student.name),
      gradeCell(grades?.prelim ?? null), gradeCell(grades?.midterm ?? null),
      gradeCell(grades?.prefinals ?? null), gradeCell(grades?.finals ?? null), gradeCell(grades?.average ?? null),
      textCell(grades?.remarks ?? null), textCell(grades?.note ?? null), textCell(status),
    ];
  });
  const gradesSheet = XLSX.utils.aoa_to_sheet([headers.map(textCell), ...rows]);
  gradesSheet["!cols"] = [{ wch: 20 }, { wch: 36 }, ...Array.from({ length: 5 }, () => ({ wch: 15 })), { wch: 22 }, { wch: 36 }, { wch: 28 }];
  gradesSheet["!autofilter"] = { ref: gradesSheet["!ref"] ?? "A1:J1" };

  const metadata = [
    ["Class code", details.classCode], ["Subject", details.subjectName], ["School year", details.schoolYear],
    ["Semester", details.semester], ["Program", details.program], ["Year level", details.yearLevel],
    ["Section", details.sectionName], ["Branch", details.branch], ["Teacher", details.teacher],
    ["Grade availability", details.gradeAvailability],
  ];
  const detailsSheet = XLSX.utils.aoa_to_sheet([[textCell("Field"), textCell("Value")], ...metadata.map((row) => row.map(textCell))]);
  detailsSheet["!cols"] = [{ wch: 22 }, { wch: 60 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, gradesSheet, "Student grades");
  XLSX.utils.book_append_sheet(workbook, detailsSheet, "Class details");
  return workbook;
}

export function classGradesExportFilename(classCode: string): string {
  const code = classCode.normalize("NFKC").trim().replace(/[^A-Za-z0-9_-]+/gu, "-")
    .replace(/[-_]{2,}/gu, "-").replace(/^[-_]+|[-_]+$/gu, "").slice(0, 80).replace(/[-_]+$/gu, "");
  return `${code || "class"}-grades.xlsx`;
}
