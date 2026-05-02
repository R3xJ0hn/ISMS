import type { LucideIcon } from "lucide-react";
import type {
  AdmissionAcademicLevelOption,
  AdmissionBranch,
  AdmissionBranchSummary,
  AdmissionProgramOption,
} from "./admission";

export type AdmissionStepId =
  | "applicant"
  | "program"
  | "student"
  | "contact"
  | "lastSchool"
  | "guardian"
  | "currentStudent"
  | "review";

export type AdmissionStep = {
  id: AdmissionStepId;
  label: string;
  title: string;
  eyebrow: string;
  icon: LucideIcon;
};

export type ApplicantFieldName =
  | "applicant_type"
  | "branch_id"
  | "branch_code"
  | "branch_title";

export type ApplicantFormValues = Record<ApplicantFieldName, string>;

export type ApplicantStepProps = {
  form: ApplicantFormValues;
  onChange: (field: ApplicantFieldName, value: string) => void;
};

export type AdmissionApplicantTypeOption = {
  value: string;
  title: string;
  description: string;
};

export type ApplicantBranch = Omit<AdmissionBranch, "address">;

export type BranchesStatus = "loading" | "success" | "error";

export type CurrentStudentFieldName =
  | "current_student_number"
  | "current_student_email"
  | "current_student_first_name"
  | "current_student_last_name"
  | "current_student_birth_date";

export type CurrentStudentVerification = {
  recordId: string;
  displayName: string;
  schoolYear: string;
  program: string;
  branch: string;
  message?: string;
};

export type CurrentStudentStepHandle = {
  verify: () => Promise<boolean>;
};

export type CurrentStudentFormValues = Record<
  | CurrentStudentFieldName
  | "applicant_type"
  | "branch_id"
  | "branch_code"
  | "branch_title"
  | "current_student_record_id"
  | "current_student_verified_name"
  | "current_student_verified_school_year"
  | "current_student_verified_program"
  | "current_student_verified_branch",
  string
>;

export type CurrentStudentStepProps = {
  form: CurrentStudentFormValues;
  onChange: (field: CurrentStudentFieldName, value: string) => void;
  onVerified: (verification: CurrentStudentVerification) => void;
};

export type CurrentStudentVerificationStatus =
  | "idle"
  | "verifying"
  | "failed"
  | "verified";

export type StudentFieldName =
  | "student_first_name"
  | "student_last_name"
  | "student_middle_name"
  | "student_suffix"
  | "student_birth_date"
  | "student_gender"
  | "student_civil_status"
  | "student_citizenship"
  | "student_birthplace"
  | "student_religion";

export type StudentFormValues = Record<StudentFieldName, string>;

export type StudentStepProps = {
  form: StudentFormValues;
  onChange: (field: StudentFieldName, value: string) => void;
};

export type ContactFieldName =
  | "contact_email"
  | "contact_phone"
  | "contact_facebook"
  | "address_house_number"
  | "address_subdivision"
  | "address_street"
  | "address_barangay"
  | "address_city"
  | "address_province"
  | "address_postal_code";

export type ContactFormValues = Record<ContactFieldName, string>;

export type ContactStepProps = {
  form: ContactFormValues;
  onChange: (field: ContactFieldName, value: string) => void;
};

export type GuardianFieldName =
  | "guardian_last_name"
  | "guardian_first_name"
  | "guardian_middle_name"
  | "guardian_suffix"
  | "guardian_relationship"
  | "guardian_contact_number"
  | "guardian_occupation";

export type GuardianFormValues = Record<GuardianFieldName, string>;

export type GuardianStepProps = {
  form: GuardianFormValues;
  onChange: (field: GuardianFieldName, value: string) => void;
};

export type LastSchoolFieldName =
  | "last_school_name"
  | "last_school_id"
  | "last_school_short_name"
  | "last_school_type"
  | "last_school_house_number"
  | "last_school_subdivision"
  | "last_school_street"
  | "last_school_barangay"
  | "last_school_city"
  | "last_school_province"
  | "last_school_postal_code"
  | "last_school_year"
  | "last_school_graduation_date"
  | "last_school_year_level";

export type LastSchoolFormValues = Record<LastSchoolFieldName, string>;

export type LastSchoolStepProps = {
  form: LastSchoolFormValues;
  onChange: (field: LastSchoolFieldName, value: string) => void;
};

export type ProgramFieldName =
  | "branch_code"
  | "branch_title"
  | "program_type"
  | "program_id"
  | "program_code"
  | "program_label"
  | "academic_level_id"
  | "academic_level_label";

export type ProgramFormValues = {
  branch_id: string;
  branch_code: string;
  branch_title: string;
  program_type: string;
  program_id: string;
  program_code: string;
  program_label: string;
  academic_level_id: string;
  academic_level_label: string;
};

export type ProgramStepProps = {
  form: ProgramFormValues;
  onChange: (field: ProgramFieldName, value: string) => void;
};

export type BranchSummary = AdmissionBranchSummary;

export type AcademicLevelOption = AdmissionAcademicLevelOption;

export type ProgramOption = AdmissionProgramOption;

export type ProgramOptionsStatus = "idle" | "loading" | "success" | "error";

export type ReviewFormValues = {
  applicant_type: string;
  branch_id: string;
  branch_code: string;
  branch_title: string;
  program_type: string;
  program_code: string;
  program_label: string;
  academic_level_label: string;
  student_first_name: string;
  student_last_name: string;
  student_middle_name: string;
  student_suffix: string;
  student_birth_date: string;
  student_gender: string;
  student_civil_status: string;
  student_citizenship: string;
  student_birthplace: string;
  student_religion: string;
  contact_email: string;
  contact_phone: string;
  contact_facebook: string;
  address_house_number: string;
  address_subdivision: string;
  address_street: string;
  address_barangay: string;
  address_city: string;
  address_province: string;
  address_postal_code: string;
  last_school_name: string;
  last_school_id: string;
  last_school_short_name: string;
  last_school_type: string;
  last_school_house_number: string;
  last_school_subdivision: string;
  last_school_street: string;
  last_school_barangay: string;
  last_school_city: string;
  last_school_province: string;
  last_school_postal_code: string;
  last_school_year: string;
  last_school_graduation_date: string;
  last_school_year_level: string;
  guardian_last_name: string;
  guardian_first_name: string;
  guardian_middle_name: string;
  guardian_suffix: string;
  guardian_relationship: string;
  guardian_contact_number: string;
  guardian_occupation: string;
  current_student_record_id: string;
  current_student_verified_name: string;
  current_student_verified_school_year: string;
  current_student_verified_program: string;
  current_student_verified_branch: string;
};

export type ReviewStepProps = {
  form: ReviewFormValues;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
};

export type AdmissionFormValues = ReviewFormValues & {
  program_id: string;
  academic_level_id: string;
  current_student_number: string;
  current_student_email: string;
  current_student_first_name: string;
  current_student_last_name: string;
  current_student_birth_date: string;
  current_year_level: string;
  current_section: string;
  current_school_year: string;
};

export type AdmissionFieldName = keyof AdmissionFormValues;

export type AdmissionSubmissionStatus = "idle" | "submitting" | "submitted";

export type AdmissionConfirmation = {
  message: string;
  submissionId: string;
  submittedAt: string;
};

export type ExistingStudentNotice = {
  message: string;
};

export type AdmissionUpdatePageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export type AdmissionUpdatePasswordPageProps = {
  searchParams: Promise<{
    token?: string;
  }>;
};

export type UpdateStudentFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type SetStudentPasswordFormState = {
  status: "idle" | "error";
  message: string;
};
