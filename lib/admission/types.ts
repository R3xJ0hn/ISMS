import type {
  ApplicationStatus,
  ProgramType,
  SchoolType,
} from "@/lib/generated/prisma/enums";
import type { HTMLInputTypeAttribute, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

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
  address: BranchAddress | null;
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
      address: BranchAddress | null;
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

export type AdmissionFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
};

export type AdmissionTextFieldProps<T extends string> = {
  id: T;
  label: string;
  value: string;
  onChange: (field: T, value: string) => void;
  type?: HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
};

export type AdmissionSelectFieldProps<T extends string> = {
  id: T;
  label: string;
  value: string;
  onChange: (field: T, value: string) => void;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  placeholder: string;
};

export type AdmissionTextAreaFieldProps<T extends string> = {
  id: T;
  label: string;
  value: string;
  onChange: (field: T, value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  rows?: number;
};
