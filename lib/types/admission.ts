import type { StudentSubmissionProfile } from "@/lib/admission/student-fields";
import type { AcademicLevelOption, Address, Branch, BranchSummary, ProgramOption } from "./catalog";

export type BranchAddress = Address;
export type AdmissionBranch = Branch;
export type AdmissionBranchSummary = BranchSummary;
export type AdmissionAcademicLevelOption = AcademicLevelOption;
export type AdmissionProgramOption = ProgramOption;

export type AdmissionBranchesResult = {
  branches: AdmissionBranch[];
  error?: string;
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
    latestAdmission?: {
      branch: string | null;
      program: string | null;
      yearLevel: string | null;
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
  current_student_verified_program: string;
  current_student_verified_branch: string;
};
