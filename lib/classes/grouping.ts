import { academicLevelOptions, formatAcademicLevel, formatSemester, semesterOptions } from "@/lib/academic-levels";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AcademicLevel, Semester } from "@/lib/generated/prisma/enums";

/** Keep teacher and student lists in the same stable school/program/lifecycle order. */
export const classListOrderBy = [
  { schoolYear: "desc" },
  { semester: "asc" },
  { program: { code: "asc" } },
  { program: { label: "asc" } },
  { programId: "asc" },
  { yearLevel: "asc" },
  { status: "asc" },
  { subjectName: "asc" },
  { sectionName: "asc" },
  { classCode: "asc" },
  { id: "asc" },
] satisfies Prisma.ClassOrderByWithRelationInput[];

type ClassGroupRow = {
  schoolYear: string;
  semester?: Semester | null;
  programId: string | null;
  programLabel?: string | null;
  yearLevel: AcademicLevel;
};

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
const semesterOrder = (value: Semester | null | undefined) => {
  const index = semesterOptions.findIndex((option) => option.value === value);
  return index < 0 ? semesterOptions.length : index;
};
const yearLevelOrder = (value: AcademicLevel) => {
  const index = academicLevelOptions.findIndex((option) => option.value === value);
  return index < 0 ? academicLevelOptions.length : index;
};

export const classTableGrouping = {
  key: (row: ClassGroupRow) => JSON.stringify([row.schoolYear, row.semester ?? null, row.programId, row.yearLevel]),
  label: (row: ClassGroupRow) => [row.schoolYear, formatSemester(row.semester), row.programLabel ?? "Program not assigned", formatAcademicLevel(row.yearLevel)].join(" / "),
  compare: (left: ClassGroupRow, right: ClassGroupRow) =>
    collator.compare(right.schoolYear, left.schoolYear) ||
    semesterOrder(left.semester) - semesterOrder(right.semester) ||
    Number(left.programId === null) - Number(right.programId === null) ||
    collator.compare(left.programLabel ?? "", right.programLabel ?? "") ||
    collator.compare(left.programId ?? "", right.programId ?? "") ||
    yearLevelOrder(left.yearLevel) - yearLevelOrder(right.yearLevel),
};
