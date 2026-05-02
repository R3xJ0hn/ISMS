import { randomUUID } from "node:crypto";

import { CivilStatus, Gender, SchoolType } from "@/lib/generated/prisma/enums";
import type {
  AdmissionProgramOptionsResult,
  AdmissionSubmissionResult,
  CanonicalAdmissionProgramSelection,
} from "@/lib/types";
import {
  enumIncludes,
  missingRequiredField,
  normalizeForm,
  parseDateInput,
  validateEmail,
  validatePhone,
  validateSchoolYear,
} from "@/lib/utils";
import { normalizeName, normalizeText } from "@/lib/utils";
import {
  findExistingStudentVerificationRecord,
  getCanonicalAdmissionProgramSelectionByIds,
  saveAdmissionSubmission,
} from "@/lib/data-access/admission";
import { getAdmissionProgramOfferings } from "@/lib/data-access/branches";

const EXISTING_STUDENT = "Existing Student";
const NEW_STUDENT = "New Student";


const requiredFields = [
  "applicant_type",
  "branch_id",
  "program_type",
  "program_id",
  "academic_level_id",
  "student_first_name",
  "student_last_name",
  "student_birth_date",
  "student_gender",
  "student_civil_status",
  "student_citizenship",
  "student_birthplace",
  "contact_email",
  "contact_phone",
  "address_barangay",
  "address_city",
  "address_province",
  "last_school_name",
  "last_school_type",
  "last_school_barangay",
  "last_school_city",
  "last_school_province",
  "last_school_year",
  "last_school_year_level",
  "guardian_first_name",
  "guardian_last_name",
  "guardian_relationship",
  "guardian_contact_number",
] as const;

const existingStudentRequiredFields = [
  "current_student_number",
  "current_student_email",
  "current_student_first_name",
  "current_student_last_name",
  "current_student_birth_date",
  "current_student_record_id",
] as const;

const allowedSubmissionFields = [
  "applicant_type",
  "branch_id",
  "branch_code",
  "branch_title",
  "program_type",
  "program_id",
  "program_code",
  "program_label",
  "academic_level_id",
  "academic_level_label",
  "student_first_name",
  "student_last_name",
  "student_middle_name",
  "student_suffix",
  "student_birth_date",
  "student_gender",
  "student_civil_status",
  "student_citizenship",
  "student_birthplace",
  "student_religion",
  "contact_email",
  "contact_phone",
  "contact_facebook",
  "address_house_number",
  "address_subdivision",
  "address_street",
  "address_barangay",
  "address_city",
  "address_province",
  "address_postal_code",
  "last_school_name",
  "last_school_id",
  "last_school_short_name",
  "last_school_type",
  "last_school_house_number",
  "last_school_subdivision",
  "last_school_street",
  "last_school_barangay",
  "last_school_city",
  "last_school_province",
  "last_school_postal_code",
  "last_school_year",
  "last_school_graduation_date",
  "last_school_year_level",
  "guardian_last_name",
  "guardian_first_name",
  "guardian_middle_name",
  "guardian_suffix",
  "guardian_relationship",
  "guardian_contact_number",
  "guardian_occupation",
  "current_student_number",
  "current_student_email",
  "current_student_first_name",
  "current_student_last_name",
  "current_student_birth_date",
  "current_student_record_id",
  "current_student_verified_name",
  "current_student_verified_school_year",
  "current_student_verified_program",
  "current_student_verified_branch",
  "current_year_level",
  "current_section",
  "current_school_year",
] as const;

const fieldLabels: Record<string, string> = {
  applicant_type: "Applicant type",
  branch_id: "Branch",
  program_type: "Program type",
  program_id: "Course",
  academic_level_id: "Academic level",
  student_first_name: "Student first name",
  student_last_name: "Student last name",
  student_birth_date: "Student birth date",
  student_gender: "Student gender",
  student_civil_status: "Student civil status",
  student_citizenship: "Student citizenship",
  student_birthplace: "Student birthplace",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  address_barangay: "Address barangay",
  address_city: "Address city",
  address_province: "Address province",
  last_school_name: "Last school name",
  last_school_type: "Last school type",
  last_school_barangay: "Last school barangay",
  last_school_city: "Last school city",
  last_school_province: "Last school province",
  last_school_year: "Last school year",
  last_school_year_level: "Last school year level",
  last_school_graduation_date: "Last school graduation date",
  guardian_first_name: "Guardian first name",
  guardian_last_name: "Guardian last name",
  guardian_relationship: "Guardian relationship",
  guardian_contact_number: "Guardian contact number",
  current_student_number: "Current student number",
  current_student_email: "Current student email",
  current_student_first_name: "Current student first name",
  current_student_last_name: "Current student last name",
  current_student_birth_date: "Current student birth date",
  current_student_record_id: "Verified student record",
};

function firstInvalidField(
  form: Record<string, string>,
  applicantType: string,
) {
  const validations: Array<{
    field: string;
    validate: (value: string) => boolean;
    when?: boolean;
  }> = [
    {
      field: "contact_email",
      validate: validateEmail,
    },
    {
      field: "contact_phone",
      validate: validatePhone,
    },
    {
      field: "guardian_contact_number",
      validate: validatePhone,
    },
    {
      field: "student_birth_date",
      validate: (value) => parseDateInput(value) !== null,
    },
    {
      field: "student_gender",
      validate: (value) => enumIncludes(Gender, value),
    },
    {
      field: "student_civil_status",
      validate: (value) => enumIncludes(CivilStatus, value),
    },
    {
      field: "last_school_type",
      validate: (value) => enumIncludes(SchoolType, value),
    },
    {
      field: "last_school_year",
      validate: validateSchoolYear,
    },
    {
      field: "last_school_graduation_date",
      validate: (value) => parseDateInput(value) !== null,
      when: Boolean(form.last_school_graduation_date),
    },
    {
      field: "current_student_email",
      validate: validateEmail,
      when: applicantType === EXISTING_STUDENT,
    },
    {
      field: "current_student_birth_date",
      validate: (value) => parseDateInput(value) !== null,
      when: applicantType === EXISTING_STUDENT,
    },
  ];

  return (
    validations.find(
      ({ field, validate, when = true }) =>
        when && !validate(form[field] ?? ""),
    )?.field ?? null
  );
}

async function existingStudentVerificationMatches(
  form: Record<string, string>,
) {
  const recordId = form.current_student_record_id;
  const branchId = form.branch_id;

  if (!/^\d+$/.test(recordId) || !/^\d+$/.test(branchId)) {
    return false;
  }

  const selectedBranchId = BigInt(branchId);
  const submittedBirthDate = parseDateInput(
    form.current_student_birth_date,
  );

  if (!submittedBirthDate) {
    return false;
  }

  const student = await findExistingStudentVerificationRecord({
    recordId: BigInt(recordId),
    branchId: selectedBranchId,
  });

  if (!student) {
    return false;
  }

  const latestEnrollment = student.enrollments[0];
  const latestApplication = student.applications[0];

  if (!latestEnrollment && !latestApplication) {
    return false;
  }

  return (
    normalizeText(student.studentNumber) === form.current_student_number &&
    student.email.toLowerCase() === form.current_student_email.toLowerCase() &&
    normalizeName(student.firstName).toLowerCase() ===
      normalizeName(form.current_student_first_name).toLowerCase() &&
    normalizeName(student.lastName).toLowerCase() ===
      normalizeName(form.current_student_last_name).toLowerCase() &&
    student.birthDate.getTime() === submittedBirthDate.getTime()
  );
}

export async function getAdmissionProgramOptions(
  branchId: string,
): Promise<AdmissionProgramOptionsResult> {
  const normalizedBranchId = normalizeText(branchId);

  if (!/^\d+$/.test(normalizedBranchId)) {
    return {
      programs: [],
      error: "A valid branchId is required.",
    };
  }

  try {
    const offerings = await getAdmissionProgramOfferings(
      BigInt(normalizedBranchId),
    );

    if (!offerings) {
      return {
        programs: [],
        error: "Branch not found.",
      };
    }

    return {
      branch: offerings.branch,
      programs: offerings.programs,
    };
  } catch (error) {
    console.error("Failed to fetch admission program options:", error);

    return {
      programs: [],
      error: "Failed to fetch admission program options.",
    };
  }
}

async function getCanonicalAdmissionProgramSelection(
  form: Record<string, string>,
): Promise<CanonicalAdmissionProgramSelection | null> {
  const branchId = form.branch_id;
  const programId = form.program_id;
  const academicLevelsId = form.academic_level_id;

  if (
    !/^\d+$/.test(branchId) ||
    !/^\d+$/.test(programId) ||
    !/^\d+$/.test(academicLevelsId)
  ) {
    return null;
  }

  return getCanonicalAdmissionProgramSelectionByIds({
    branchId: BigInt(branchId),
    programId: BigInt(programId),
    academicLevelsId: BigInt(academicLevelsId),
    programType: form.program_type,
  });
}

function applyCanonicalProgramSelection(
  form: Record<string, string>,
  selection: CanonicalAdmissionProgramSelection,
) {
  return {
    ...form,
    branch_id: selection.branchId.toString(),
    branch_code: selection.branchCode,
    branch_title: selection.branchTitle,
    program_type: selection.programType,
    program_id: selection.programId.toString(),
    program_code: selection.programCode,
    program_label: selection.programLabel,
    academic_level_id: selection.academicLevelsId.toString(),
    academic_level_label: selection.academicLevelLabel,
  };
}



export async function submitAdmissionApplication(
  formInput: unknown,
  consent: boolean,
): Promise<AdmissionSubmissionResult> {
  const form =
    formInput && typeof formInput === "object" && !Array.isArray(formInput)
      ? (formInput as Record<string, unknown>)
      : null;

  if (!form) {
    return {
      submitted: false,
      message: "Admission form data is missing.",
    };
  }

  if (consent !== true) {
    return {
      submitted: false,
      message: "Review consent is required before submitting the form.",
    };
  }

  const applicantType = normalizeText(form.applicant_type);

  if (applicantType !== NEW_STUDENT && applicantType !== EXISTING_STUDENT) {
    return {
      submitted: false,
      message: "Select a valid applicant type before submitting.",
    };
  }

  const missingBaseField = missingRequiredField(form, requiredFields);

  if (missingBaseField) {
    return {
      submitted: false,
      message: `${fieldLabels[missingBaseField] ?? "A required field"} is required before submitting.`,
    };
  }

  const normalizedForm = normalizeForm(form, allowedSubmissionFields);
  const invalidField = firstInvalidField(normalizedForm, applicantType);

  if (invalidField) {
    return {
      submitted: false,
      message: `${fieldLabels[invalidField] ?? "Invalid field"} is invalid`,
    };
  }

  let programSelection: CanonicalAdmissionProgramSelection;

  try {
    const canonicalSelection =
      await getCanonicalAdmissionProgramSelection(normalizedForm);

    if (!canonicalSelection) {
      return {
        submitted: false,
        message: "Select a valid branch and program before submitting.",
      };
    }

    programSelection = canonicalSelection;
  } catch (error) {
    console.error("Failed to validate admission program selection:", error);

    return {
      submitted: false,
      message:
        "We could not validate your selected program right now. Please try again.",
    };
  }

  const canonicalForm = applyCanonicalProgramSelection(
    normalizedForm,
    programSelection,
  );

  if (applicantType === EXISTING_STUDENT) {
    const missingExistingField = missingRequiredField(
      form,
      existingStudentRequiredFields,
    );

    if (missingExistingField) {
      return {
        submitted: false,
        message:
          missingExistingField === "current_student_record_id"
            ? "Verify your current student record before submitting."
            : `${fieldLabels[missingExistingField] ?? "A required field"} is required before submitting.`,
      };
    }

    try {
      const verified = await existingStudentVerificationMatches(canonicalForm);

      if (!verified) {
        return {
          submitted: false,
          message:
            "Current student verification details do not match our records.",
        };
      }
    } catch (error) {
      console.error("Failed to validate current student record:", error);

      return {
        submitted: false,
        message:
          "We could not validate the current student record right now. Please try again.",
      };
    }
  }

  const submissionId = randomUUID()
    .replace(/\D/g, "")
    .padEnd(8, "0")
    .slice(0, 8);
  const submittedAt = new Date().toISOString();

  try {
    await saveAdmissionSubmission({
      submissionId,
      submittedAt: new Date(submittedAt),
      form: canonicalForm,
      programSelection,
    });

    return {
      submitted: true,
      submissionId,
      submittedAt,
      message:
        "Your admission form has been submitted to the registrar for review.",
    };
  } catch (error) {
    console.error("Failed to store admission submission:", error);

    return {
      submitted: false,
      message:
        "We could not save your admission form right now. Please try again.",
    };
  }
}
