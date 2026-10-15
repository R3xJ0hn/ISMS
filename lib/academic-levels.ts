import { AcademicLevel, ProgramType } from "@/lib/generated/prisma/enums";

export type AcademicLevelOption = { value: AcademicLevel; label: string; slug: string };

export const academicLevelOptions: readonly AcademicLevelOption[] = [
  { value: AcademicLevel.Grade11, label: "Grade 11", slug: "grade-11" },
  { value: AcademicLevel.Grade12, label: "Grade 12", slug: "grade-12" },
  { value: AcademicLevel.FirstYear, label: "First Year", slug: "first-year" },
  { value: AcademicLevel.SecondYear, label: "Second Year", slug: "second-year" },
  { value: AcademicLevel.ThirdYear, label: "Third Year", slug: "third-year" },
  { value: AcademicLevel.FourthYear, label: "Fourth Year", slug: "fourth-year" },
];

const allowedLevelsByProgramType: Record<ProgramType, readonly AcademicLevel[]> = {
  Bachelor: [AcademicLevel.FirstYear, AcademicLevel.SecondYear, AcademicLevel.ThirdYear, AcademicLevel.FourthYear],
  SeniorHigh: [AcademicLevel.Grade11, AcademicLevel.Grade12],
  Associate: [AcademicLevel.FirstYear, AcademicLevel.SecondYear],
};

export function getAcademicLevelOption(value: unknown) {
  return academicLevelOptions.find((option) => option.value === value);
}

export function formatAcademicLevel(value: AcademicLevel) {
  return getAcademicLevelOption(value)?.label ?? "";
}

export function isAcademicLevelAllowedForProgram(programType: string, academicLevel: AcademicLevel) {
  return Object.hasOwn(allowedLevelsByProgramType, programType) &&
    allowedLevelsByProgramType[programType as ProgramType].includes(academicLevel);
}
