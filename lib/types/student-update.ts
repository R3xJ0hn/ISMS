import type {
  ApplicationStatus,
  ProgramType,
  SchoolType,
} from "@/lib/generated/prisma/enums";
import type { CompleteAddress } from "./address";

export type StudentUpdateTokenPayload = {
  scope: "student-update";
  studentId: string;
  jti: string;
  exp: number;
};

export type StudentUpdateRecord = {
  token: string;
  studentId: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender: string | null;
  civilStatus: string | null;
  citizenship: string | null;
  birthplace: string | null;
  religion: string;
  email: string;
  phone: string | null;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMiddleName: string;
  guardianSuffix: string;
  guardianRelationship: string;
  guardianContactNumber: string;
  guardianOccupation: string;
  lastSchoolName: string;
  lastSchoolId: string;
  lastSchoolShortName: string;
  lastSchoolType: string;
  lastSchoolHouseNumber: string;
  lastSchoolSubdivision: string;
  lastSchoolStreet: string;
  lastSchoolBarangay: string;
  lastSchoolCity: string;
  lastSchoolProvince: string;
  lastSchoolPostalCode: string;
  lastSchoolYear: string;
  lastSchoolGraduationDate: string;
  lastSchoolYearLevel: string;
  latestEnrollmentStatus: string;
  latestEnrollmentSchoolYear: string;
  latestEnrollmentBranch: string;
  latestEnrollmentProgram: string;
  latestEnrollmentYearLevel: string;
  latestEnrollmentSection: string;
};

export type UpdateStudentRecordInput = {
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender?: string | null;
  civilStatus?: string | null;
  citizenship?: string | null;
  birthplace?: string | null;
  religion: string;
  email: string;
  phone?: string | null;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMiddleName: string;
  guardianSuffix: string;
  guardianRelationship: string;
  guardianContactNumber: string;
  guardianOccupation: string;
  lastSchoolName: string;
  lastSchoolId: string;
  lastSchoolShortName: string;
  lastSchoolType: string;
  lastSchoolHouseNumber: string;
  lastSchoolSubdivision: string;
  lastSchoolStreet: string;
  lastSchoolBarangay: string;
  lastSchoolCity: string;
  lastSchoolProvince: string;
  lastSchoolPostalCode: string;
  lastSchoolYear: string;
  lastSchoolGraduationDate: string;
  lastSchoolYearLevel: string;
};

export type StudentUpdateQueryResult = {
  id: bigint;
  firstName: string;
  lastName: string;
  middleName: string | null;
  suffix: string | null;
  birthDate: Date;
  gender: string | null;
  civilStatus: string | null;
  citizenship: string | null;
  birthplace: string | null;
  religion: string | null;
  email: string;
  phone: string | null;
  facebookAccount: string | null;
  address: CompleteAddress | null;
  guardians: Array<{
    relationship: string;
    isPrimary: boolean;
    guardian: {
      firstName: string;
      lastName: string;
      middleName: string | null;
      suffix: string | null;
      contactNumber: string;
      occupation: string | null;
    };
  }>;
  applications: Array<{
    id: bigint;
    branchId: bigint;
    programId: bigint;
    academicLevelsId: bigint;
    programType: (typeof ProgramType)[keyof typeof ProgramType];
    lastSchoolId: bigint | null;
    LSSchoolYearEnd: string | null;
    LSAttainedLevelText: string | null;
    LSGraduationDate: Date | null;
    applicationStatus: (typeof ApplicationStatus)[keyof typeof ApplicationStatus];
    submittedAt: Date | null;
    branch: {
      title: string;
    };
    program: {
      label: string;
    };
    academicLevels: {
      label: string;
    };
    lastSchool: {
      schoolName: string;
      schoolId: string | null;
      shortName: string | null;
      schoolType: (typeof SchoolType)[keyof typeof SchoolType];
      address: CompleteAddress | null;
    } | null;
  }>;
  enrollments: Array<{
    branchId: bigint;
    programId: bigint;
    academicLevelsId: bigint;
    enrollmentStatus: string;
    schoolYear: {
      name: string;
    };
    branch: {
      title: string;
    };
    program: {
      label: string;
      programType: (typeof ProgramType)[keyof typeof ProgramType];
    };
    academicLevels: {
      label: string;
    };
    section: {
      sectionName: string;
      sectionCode: string;
    } | null;
  }>;
};

export type StudentUpdatePasswordRecord = {
  token: string;
  studentId: string;
  displayName: string;
  email: string;
};

export type SetStudentPasswordInput = {
  password: string;
  confirmPassword: string;
};
