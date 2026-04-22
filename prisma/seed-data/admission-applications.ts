import { defineSeed } from "../_factory";
import {
  ApplicantType,
  ApplicationStatus,
  ProgramType,
} from "../../lib/generated/prisma/enums";
import {
  assertAcademicLevelAllowedForProgramType,
  assertProgramTypeMatchesSeedProgram,
  findStudentIdsByNumbers,
  uniqueStrings,
} from "./_helpers";

type AdmissionApplicationSeedRow = {
  studentKey: string;
  applicantType: (typeof ApplicantType)[keyof typeof ApplicantType];
  applicationStatus: (typeof ApplicationStatus)[keyof typeof ApplicationStatus];
  lastSchoolKey: string | null;
  LSSchoolYearEnd: string | null;
  LSAttainedLevelText: string | null;
  LSGraduationDate: string | null;
  branchKey: string;
  programType: (typeof ProgramType)[keyof typeof ProgramType];
  programKey: string;
  academicLevelKey: string;
  remarks: string | null;
  submittedAt: string | null;
};

export const seedAdmissionApplications = [
  {
    studentKey: "2612345",
    applicantType: ApplicantType.existing,
    applicationStatus: ApplicationStatus.approved,
    lastSchoolKey: "meycauayan-national-high",
    LSSchoolYearEnd: "2023-2024",
    LSAttainedLevelText: "Grade 12",
    LSGraduationDate: "2024-04-15",
    branchKey: "meycauayan",
    programType: ProgramType.Bachelor,
    programKey: "bsit",
    academicLevelKey: "second-year",
    remarks: "Returning BSIT student for SY 2025-2026.",
    submittedAt: "2025-06-15T09:00:00.000Z",
  },
  {
    studentKey: "2612346",
    applicantType: ApplicantType.existing,
    applicationStatus: ApplicationStatus.submitted,
    lastSchoolKey: "commonwealth-senior-high",
    LSSchoolYearEnd: "2024-2025",
    LSAttainedLevelText: "Grade 12",
    LSGraduationDate: "2025-04-10",
    branchKey: "fairview",
    programType: ProgramType.Bachelor,
    programKey: "bsba",
    academicLevelKey: "first-year",
    remarks: "Fresh college intake routed through Fairview.",
    submittedAt: "2025-05-20T11:30:00.000Z",
  },
  {
    studentKey: "2612347",
    applicantType: ApplicantType.existing,
    applicationStatus: ApplicationStatus.reviewing,
    lastSchoolKey: "caloocan-business-high",
    LSSchoolYearEnd: "2021-2022",
    LSAttainedLevelText: "Grade 12",
    LSGraduationDate: "2022-04-08",
    branchKey: "caloocan",
    programType: ProgramType.Bachelor,
    programKey: "bshm",
    academicLevelKey: "third-year",
    remarks: "Continuing BSHM student pending document refresh.",
    submittedAt: "2024-05-18T08:15:00.000Z",
  },
  {
    studentKey: "2612348",
    applicantType: ApplicantType.new,
    applicationStatus: ApplicationStatus.approved,
    lastSchoolKey: "valenzuela-senior-high",
    LSSchoolYearEnd: "2024-2025",
    LSAttainedLevelText: "Grade 10",
    LSGraduationDate: "2025-03-28",
    branchKey: "valenzuela",
    programType: ProgramType.SeniorHigh,
    programKey: "shs-stem",
    academicLevelKey: "grade-11",
    remarks: "Incoming Grade 11 STEM student.",
    submittedAt: "2025-04-25T10:00:00.000Z",
  },
  {
    studentKey: "2612349",
    applicantType: ApplicantType.new,
    applicationStatus: ApplicationStatus.submitted,
    lastSchoolKey: "datamex-institute-tech",
    LSSchoolYearEnd: "2024-2025",
    LSAttainedLevelText: "Grade 12",
    LSGraduationDate: "2025-04-12",
    branchKey: "meycauayan",
    programType: ProgramType.Associate,
    programKey: "act",
    academicLevelKey: "first-year",
    remarks: "New ACT applicant awaiting final assessment.",
    submittedAt: "2025-05-29T13:45:00.000Z",
  },
] as const satisfies readonly AdmissionApplicationSeedRow[];

export default defineSeed({
  table: "admissionApplication",
  order: 120,
  rows: seedAdmissionApplications,
  create: async (
    { prisma, getId, dateOnly, dateTime },
    {
      studentKey,
      lastSchoolKey,
      branchKey,
      programKey,
      academicLevelKey,
      LSGraduationDate,
      submittedAt,
      ...row
    }
  ) => {
    assertProgramTypeMatchesSeedProgram(
      programKey,
      row.programType,
      `Admission application for student "${studentKey}"`
    );
    assertAcademicLevelAllowedForProgramType(
      row.programType,
      academicLevelKey,
      `Admission application for student "${studentKey}"`
    );

    return prisma.admissionApplication.create({
      data: {
        ...row,
        studentId: getId("students", studentKey, "student"),
        lastSchoolId: lastSchoolKey
          ? getId("lastSchools", lastSchoolKey, "last school")
          : null,
        branchId: getId("branches", branchKey, "branch"),
        programId: getId("programs", programKey, "program"),
        academicLevelsId: getId(
          "academicLevels",
          academicLevelKey,
          "academic level"
        ),
        LSGraduationDate: LSGraduationDate
          ? dateOnly(LSGraduationDate)
          : null,
        submittedAt: submittedAt ? dateTime(submittedAt) : null,
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

    await prisma.admissionApplication.deleteMany({
      where: {
        studentId: {
          in: studentIds,
        },
      },
    });
  },
});
