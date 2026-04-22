import type { PrismaClient } from "../../lib/generated/prisma/client";
import { ProgramType } from "../../lib/generated/prisma/enums";

import { seedPrograms } from "./programs";

type ProgramTypeValue = (typeof ProgramType)[keyof typeof ProgramType];

export function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)];
}

export const allowedAcademicLevelKeysByProgramType: Record<
  ProgramTypeValue,
  readonly string[]
> = {
  [ProgramType.Bachelor]: [
    "first-year",
    "second-year",
    "third-year",
    "fourth-year",
  ],
  [ProgramType.SeniorHigh]: ["grade-11", "grade-12"],
  [ProgramType.Associate]: ["first-year", "second-year"],
};

const seedProgramTypeByKey = new Map<string, ProgramTypeValue>(
  seedPrograms.map((row) => [row.key, row.programType] as const)
);

export function getSeedProgramType(programKey: string) {
  const programType = seedProgramTypeByKey.get(programKey);

  if (!programType) {
    throw new Error(`Missing seeded program: ${programKey}`);
  }

  return programType;
}

export function getAllowedAcademicLevelKeysForProgramType(
  programType: ProgramTypeValue
) {
  return allowedAcademicLevelKeysByProgramType[programType];
}

export function getAllowedAcademicLevelKeysForProgram(programKey: string) {
  return getAllowedAcademicLevelKeysForProgramType(getSeedProgramType(programKey));
}

export function assertAcademicLevelAllowedForProgramType(
  programType: ProgramTypeValue,
  academicLevelKey: string,
  context: string
) {
  const allowedAcademicLevels =
    allowedAcademicLevelKeysByProgramType[programType] ?? [];

  if (!allowedAcademicLevels.includes(academicLevelKey)) {
    throw new Error(
      `${context} uses academic level "${academicLevelKey}" which is invalid for program type "${programType}". Allowed levels: ${allowedAcademicLevels.join(", ")}.`
    );
  }
}

export function assertAcademicLevelAllowedForProgram(
  programKey: string,
  academicLevelKey: string,
  context: string
) {
  assertAcademicLevelAllowedForProgramType(
    getSeedProgramType(programKey),
    academicLevelKey,
    context
  );
}

export function assertProgramTypeMatchesSeedProgram(
  programKey: string,
  expectedProgramType: ProgramTypeValue,
  context: string
) {
  const actualProgramType = getSeedProgramType(programKey);

  if (actualProgramType !== expectedProgramType) {
    throw new Error(
      `${context} uses program "${programKey}" with type "${expectedProgramType}", but the seeded program type is "${actualProgramType}".`
    );
  }
}

export async function findStudentIdsByNumbers(
  prisma: PrismaClient,
  studentNumbers: readonly string[]
) {
  const students = await prisma.student.findMany({
    where: {
      studentNumber: {
        in: uniqueStrings(studentNumbers),
      },
    },
    select: {
      id: true,
    },
  });

  return students.map((student) => student.id);
}
