import { defineSeed } from "../_factory";
import { EnrollmentStatus } from "../../lib/generated/prisma/enums";
import {
  assertAcademicLevelAllowedForProgram,
  findStudentIdsByNumbers,
  uniqueStrings,
} from "./_helpers";

type EnrollmentSeedRow = {
  studentKey: string;
  branchKey: string;
  programKey: string;
  academicLevelKey: string;
  sectionKey: string;
  schoolYearKey: string;
  enrollmentStatus: (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];
  enrolledAt: string;
};

export const seedEnrollments = [
  {
    studentKey: "2612345",
    branchKey: "meycauayan",
    programKey: "bsit",
    academicLevelKey: "second-year",
    sectionKey: "mey-bsit-2a",
    schoolYearKey: "2025-2026",
    enrollmentStatus: EnrollmentStatus.enrolled,
    enrolledAt: "2025-08-12T08:00:00.000Z",
  },
  {
    studentKey: "2612346",
    branchKey: "fairview",
    programKey: "bsba",
    academicLevelKey: "first-year",
    sectionKey: "fair-bsba-1a",
    schoolYearKey: "2025-2026",
    enrollmentStatus: EnrollmentStatus.enrolled,
    enrolledAt: "2025-08-13T08:30:00.000Z",
  },
  {
    studentKey: "2612347",
    branchKey: "caloocan",
    programKey: "bshm",
    academicLevelKey: "third-year",
    sectionKey: "cal-bshm-3a",
    schoolYearKey: "2024-2025",
    enrollmentStatus: EnrollmentStatus.completed,
    enrolledAt: "2024-08-08T09:00:00.000Z",
  },
  {
    studentKey: "2612348",
    branchKey: "valenzuela",
    programKey: "shs-stem",
    academicLevelKey: "grade-11",
    sectionKey: "val-stem-11a",
    schoolYearKey: "2025-2026",
    enrollmentStatus: EnrollmentStatus.enrolled,
    enrolledAt: "2025-08-11T07:45:00.000Z",
  },
  {
    studentKey: "2612349",
    branchKey: "meycauayan",
    programKey: "act",
    academicLevelKey: "first-year",
    sectionKey: "mey-act-1b",
    schoolYearKey: "2025-2026",
    enrollmentStatus: EnrollmentStatus.pending,
    enrolledAt: "2025-08-14T10:15:00.000Z",
  },
] as const satisfies readonly EnrollmentSeedRow[];

export default defineSeed({
  table: "enrollment",
  order: 100,
  rows: seedEnrollments,
  create: async (
    { prisma, getId, dateTime },
    {
      studentKey,
      branchKey,
      programKey,
      academicLevelKey,
      sectionKey,
      schoolYearKey,
      enrolledAt,
      ...row
    }
  ) => {
    assertAcademicLevelAllowedForProgram(
      programKey,
      academicLevelKey,
      `Enrollment for student "${studentKey}"`
    );

    return prisma.enrollment.create({
      data: {
        ...row,
        studentId: getId("students", studentKey, "student"),
        branchId: getId("branches", branchKey, "branch"),
        programId: getId("programs", programKey, "program"),
        academicLevelsId: getId(
          "academicLevels",
          academicLevelKey,
          "academic level"
        ),
        sectionId: getId("sections", sectionKey, "section"),
        schoolYearId: getId("schoolYears", schoolYearKey, "school year"),
        enrolledAt: dateTime(enrolledAt),
      },
    });
  },
  down: async ({ prisma }, rows) => {
    const studentIds = await findStudentIdsByNumbers(
      prisma,
      uniqueStrings(rows.map((row) => row.studentKey))
    );

    if (studentIds.length === 0) {
      return;
    }

    await prisma.enrollment.deleteMany({
      where: {
        studentId: {
          in: studentIds,
        },
      },
    });
  },
});
