import type { StudentSubmissionProfile } from "./student-fields";

export type BranchAddress = {
  houseNumber: string | null;
  subdivision: string | null;
  street: string | null;
  barangay: string;
  city: string;
  province: string;
  postalCode: string | null;
};
export type AdmissionBranch = {
  id: string;
  code: string;
  title: string;
  image: string | null;
  phone: string | null;
  facebookText: string | null;
  mapLink: string | null;
  address: BranchAddress | null;
  formattedAddress: string;
};
export type AdmissionBranchesResult = {
  branches: AdmissionBranch[];
  error?: string;
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

export type ReviewFormValues = StudentSubmissionProfile & {
  applicant_type: string;
  branch_id: string;
  branch_code: string;
  branch_title: string;
  program_type: string;
  program_code: string;
  program_label: string;
  academic_level_label: string;
  current_student_record_id: string;
  current_student_verified_name: string;
  current_student_verified_school_year: string;
  current_student_verified_program: string;
  current_student_verified_branch: string;
};
