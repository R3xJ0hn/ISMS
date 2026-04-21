import { defineSeed } from "../_factory";
import { findStudentIdsByNumbers, uniqueStrings } from "./_helpers";

type StudentGuardianSeedRow = {
  studentKey: string;
  guardianKey: string;
  relationship: string;
  isPrimary: boolean;
};

export const seedStudentGuardians = [
  {
    studentKey: "2612345",
    guardianKey: "guardian-maria",
    relationship: "Mother",
    isPrimary: true,
  },
  {
    studentKey: "2612346",
    guardianKey: "guardian-john",
    relationship: "Father",
    isPrimary: true,
  },
  {
    studentKey: "2612347",
    guardianKey: "guardian-angela",
    relationship: "Mother",
    isPrimary: true,
  },
  {
    studentKey: "2612348",
    guardianKey: "guardian-paolo",
    relationship: "Aunt",
    isPrimary: true,
  },
  {
    studentKey: "2612349",
    guardianKey: "guardian-sofia",
    relationship: "Father",
    isPrimary: true,
  },
] as const satisfies readonly StudentGuardianSeedRow[];

export default defineSeed({
  table: "studentGuardian",
  order: 90,
  rows: seedStudentGuardians,
  create: async ({ prisma, getId }, { studentKey, guardianKey, ...row }) =>
    prisma.studentGuardian.create({
      data: {
        ...row,
        studentId: getId("students", studentKey, "student"),
        guardianId: getId("guardians", guardianKey, "guardian"),
      },
    }),
  down: async ({ prisma }, rows) => {
    const studentIds = await findStudentIdsByNumbers(
      prisma,
      uniqueStrings(rows.map((row) => row.studentKey))
    );

    if (studentIds.length === 0) {
      return;
    }

    await prisma.studentGuardian.deleteMany({
      where: {
        studentId: {
          in: studentIds,
        },
      },
    });
  },
});
