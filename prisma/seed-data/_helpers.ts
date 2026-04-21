import type { PrismaClient } from "../../lib/generated/prisma/client";

export function uniqueStrings(values: readonly string[]) {
  return [...new Set(values)];
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

export async function findLastSchoolIdsByNames(
  prisma: PrismaClient,
  schoolNames: readonly string[]
) {
  const schools = await prisma.lastSchool.findMany({
    where: {
      schoolName: {
        in: uniqueStrings(schoolNames),
      },
    },
    select: {
      id: true,
    },
  });

  return schools.map((school) => school.id);
}
