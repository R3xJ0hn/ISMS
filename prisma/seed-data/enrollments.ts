import { defineSeed } from "../_factory";
import { EnrollmentStatus } from "../../lib/generated/prisma/enums";
import { assertAcademicLevelAllowedForProgram, uniqueStrings } from "./_helpers";

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
    programKey: "bsoa",
    academicLevelKey: "first-year",
    sectionKey: "fair-bsoa-1a",
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
    programKey: "shs-gas",
    academicLevelKey: "grade-11",
    sectionKey: "val-gas-11a",
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
    const [students, schoolYears] = await Promise.all([
      prisma.student.findMany({
        where: {
          studentNumber: {
            in: uniqueStrings(rows.map((row) => row.studentKey)),
          },
        },
        select: {
          id: true,
          studentNumber: true,
        },
      }),
      prisma.schoolYear.findMany({
        where: {
          name: {
            in: uniqueStrings(rows.map((row) => row.schoolYearKey)),
          },
        },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    const studentIdByNumber = new Map(
      students.map((student) => [student.studentNumber, student.id] as const)
    );
    const schoolYearIdByName = new Map(
      schoolYears.map((schoolYear) => [schoolYear.name, schoolYear.id] as const)
    );
    const enrollmentPairs = new Map<
      string,
      { studentId: bigint; schoolYearId: bigint }
    >();

    for (const row of rows) {
      const studentId = studentIdByNumber.get(row.studentKey);
      const schoolYearId = schoolYearIdByName.get(row.schoolYearKey);

      if (!studentId || !schoolYearId) {
        continue;
      }

      enrollmentPairs.set(`${studentId}:${schoolYearId}`, {
        studentId,
        schoolYearId,
      });
    }

    if (enrollmentPairs.size === 0) {
      return;
    }

    await prisma.enrollment.deleteMany({
      where: {
        OR: [...enrollmentPairs.values()].map(({ studentId, schoolYearId }) => ({
          studentId,
          schoolYearId,
        })),
      },
    });
  },
});
