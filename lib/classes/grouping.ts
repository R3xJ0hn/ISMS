import {
  academicLevelOptions,
  formatAcademicLevel,
  formatTerm,
} from "@/lib/academic-levels";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AcademicLevel } from "@/lib/generated/prisma/enums";

/** Keep teacher and student lists in the same stable school/program/lifecycle order. */
export const classListOrderBy = [
  { schoolYear: "desc" },
  { academicTerm: { position: "asc" } },
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
  term?: string | null;
  termId?: string;
  termPosition?: number;
  programId: string | null;
  programLabel?: string | null;
  yearLevel: AcademicLevel;
};

const collator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const yearLevelOrder = (value: AcademicLevel) => {
  const index = academicLevelOptions.findIndex(
    (option) => option.value === value,
  );
  return index < 0 ? academicLevelOptions.length : index;
};

export const classTableGrouping = {
  key: (row: ClassGroupRow) =>
    JSON.stringify([
      row.schoolYear,
      row.termId ?? row.term ?? null,
      row.programId,
      row.yearLevel,
    ]),
  label: (row: ClassGroupRow) =>
    [
      row.schoolYear,
      formatTerm(row.term),
      row.programLabel ?? "Program not assigned",
      formatAcademicLevel(row.yearLevel),
    ].join(" / "),
  compare: (left: ClassGroupRow, right: ClassGroupRow) =>
    collator.compare(right.schoolYear, left.schoolYear) ||
    (left.termPosition ?? 0) - (right.termPosition ?? 0) ||
    collator.compare(left.term ?? "", right.term ?? "") ||
    Number(left.programId === null) - Number(right.programId === null) ||
    collator.compare(left.programLabel ?? "", right.programLabel ?? "") ||
    collator.compare(left.programId ?? "", right.programId ?? "") ||
    yearLevelOrder(left.yearLevel) - yearLevelOrder(right.yearLevel),
};
