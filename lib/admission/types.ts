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
