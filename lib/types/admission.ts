import type { CompleteAddress } from "./address";

export type AdmissionBranch = {
  id: string;
  code: string;
  title: string;
  image: string | null;
  phone: string | null;
  facebookText: string | null;
  mapLink: string | null;
  address: CompleteAddress | null;
  formattedAddress: string;
};

export type AdmissionBranchSummary = {
  id: string;
  title: string;
  code: string;
};

export type AdmissionAcademicLevelOption = {
  id: string;
  label: string;
  slug: string;
};

export type AdmissionProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: AdmissionAcademicLevelOption[];
};

export type AdmissionProgramOptionsResult = {
  branch?: AdmissionBranchSummary;
  programs: AdmissionProgramOption[];
  error?: string;
};

export type VerifyCurrentStudentInput = {
  branchId?: string;
  studentNumber?: string;
  studentEmail?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
};

export type VerifyCurrentStudentResult = {
  verified: boolean;
  message?: string;
  student?: {
    id: string;
    displayName: string;
    latestEnrollment?: {
      schoolYear: string | null;
      branch: string | null;
      program: string | null;
      yearLevel: string | null;
      section: string | null;
    } | null;
  };
};

export type AdmissionSubmissionResult = {
  submitted: boolean;
  submissionId?: string;
  submittedAt?: string;
  message?: string;
};

export type InternalProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: Map<string, AdmissionAcademicLevelOption>;
};

export type CanonicalAdmissionProgramSelection = {
  branchId: bigint;
  branchCode: string;
  branchTitle: string;
  programId: bigint;
  programCode: string;
  programLabel: string;
  programType: string;
  academicLevelsId: bigint;
  academicLevelLabel: string;
};

export type SaveAdmissionSubmissionInput = {
  submissionId: string;
  submittedAt: Date;
  form: Record<string, string>;
  programSelection: CanonicalAdmissionProgramSelection;
};
