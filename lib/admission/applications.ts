import type { VerifyCurrentStudentInput, VerifyCurrentStudentResult, AdmissionSubmissionResult } from "@/lib/types/admission";
import { normalizeStudentField, studentSubmissionFields, type StudentUpdateField } from "./student-fields";
import { randomUUID } from "node:crypto";

import {
  CivilStatus,
  Gender,
  SchoolType,
  type ProgramType as ProgramTypeValue,
} from "@/lib/generated/prisma/enums";
import {
  saveAdmissionSubmission,
  type CanonicalAdmissionProgramSelection,
} from "@/lib/admission/submission-store";
import { sendStudentUpdateLinkEmail } from "@/lib/admission/student-update-email";
import { createStudentUpdateUrl } from "@/lib/admission/student-update";
import { parseDateRange } from "@/lib/utils";
import { parseDateInput, validateEmail, validatePhone, validateSchoolYear } from "@/lib/validation";
import { EXISTING_STUDENT, NEW_STUDENT } from "./constants";
import { formatAcademicLevel, getAcademicLevelOption, isAcademicLevelAllowedForProgram } from "@/lib/academic-levels";
import { prisma } from "@/lib/prisma";
import { addressSelect } from "./records";
import { LastSchoolSelectionError } from "./last-school-store";
import { capitalizeInputText, formatStudentName, normalizeEmail, normalizeName, normalizeText, sanitizeInputText, enumIncludes } from "@/lib/utils";

const MISSING_FIELDS_MESSAGE =
  "Complete all verification fields before checking the record.";
const VERIFICATION_FAILED_MESSAGE = "Verification failed.";

const requiredFields = [
  "applicant_type",
  "branch_id",
  "program_type",
  "program_id",
  "academic_level",
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
  "academic_level",
  "academic_level_label",
  "last_school_record_id",
  ...Object.values(studentSubmissionFields),
  "current_student_number",
  "current_student_email",
  "current_student_first_name",
  "current_student_last_name",
  "current_student_birth_date",
  "current_student_record_id",
  "current_student_verified_name",
  "current_student_verified_program",
  "current_student_verified_branch",
] as const;

const fieldLabels: Record<string, string> = {
  applicant_type: "Applicant type",
  branch_id: "Branch",
  program_type: "Program type",
  program_id: "Course",
  academic_level: "Academic level",
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

function normalizeForm(form: Record<string, unknown>) {
  const normalized: Record<string, string> = {};
  const profileFieldBySubmissionField = new Map<string, StudentUpdateField>(
    Object.entries(studentSubmissionFields).map(([field, submissionField]) => [submissionField, field as StudentUpdateField])
  );
  const capitalizedFields = new Set([
    "current_student_first_name", "current_student_last_name", "current_student_verified_name",
    "current_student_verified_program", "current_student_verified_branch",
  ]);

  for (const field of allowedSubmissionFields) {
    const profileField = profileFieldBySubmissionField.get(field);
    normalized[field] = profileField
      ? normalizeStudentField(profileField, form[field])
      : field === "current_student_email"
        ? normalizeEmail(sanitizeInputText(form[field]))
        : capitalizedFields.has(field)
          ? capitalizeInputText(form[field])
          : sanitizeInputText(form[field]);
  }

  return normalized;
}

function missingRequiredField(
  form: Record<string, unknown>,
  fields: readonly string[]
) {
  return fields.find((field) => !normalizeText(form[field])) ?? null;
}

function firstInvalidField(
  form: Record<string, string>,
  applicantType: string
) {
  const validations: Array<[string, (value: string) => boolean, boolean?]> = [
    ["contact_email", validateEmail],
    ["contact_phone", validatePhone],
    ["guardian_contact_number", validatePhone],
    ["student_birth_date", (value) => parseDateInput(value) !== null],
    ["student_gender", (value) => enumIncludes(Gender, value)],
    ["student_civil_status", (value) => enumIncludes(CivilStatus, value)],
    ["last_school_type", (value) => enumIncludes(SchoolType, value)],
    ["last_school_year", validateSchoolYear],
    ["last_school_graduation_date", (value) => parseDateInput(value) !== null, Boolean(form.last_school_graduation_date)],
    ["current_student_email", validateEmail, applicantType === EXISTING_STUDENT],
    ["current_student_birth_date", (value) => parseDateInput(value) !== null, applicantType === EXISTING_STUDENT],
  ];

  return validations.find(([field, validate, when = true]) => when && !validate(form[field] ?? ""))?.[0] ?? null;
}

function parseAdmissionId(value: string) {
  if (!/^\d{1,19}$/.test(value)) return null;
  const id = BigInt(value);
  return id > 0n && id <= 9223372036854775807n ? id : null;
}

async function applyCanonicalLastSchoolSelection(form: Record<string, string>) {
  const recordId = parseAdmissionId(form.last_school_record_id);
  if (!recordId) return null;

  const school = await prisma.lastSchool.findUnique({
    where: { id: recordId },
    select: {
      id: true, schoolName: true, schoolId: true, shortName: true, schoolType: true,
      address: { select: addressSelect },
    },
  });
  if (!school?.address) return null;

  const schoolProfile = {
    lastSchoolName: school.schoolName,
    lastSchoolId: school.schoolId ?? "",
    lastSchoolShortName: school.shortName ?? "",
    lastSchoolType: school.schoolType,
    lastSchoolHouseNumber: school.address.houseNumber ?? "",
    lastSchoolSubdivision: school.address.subdivision ?? "",
    lastSchoolStreet: school.address.street ?? "",
    lastSchoolBarangay: school.address.barangay,
    lastSchoolCity: school.address.city,
    lastSchoolProvince: school.address.province,
    lastSchoolPostalCode: school.address.postalCode ?? "",
  };
  const canonicalFields = Object.fromEntries(Object.entries(schoolProfile).map(([field, value]) => [
    studentSubmissionFields[field as StudentUpdateField],
    normalizeStudentField(field as StudentUpdateField, value),
  ]));
  if (["last_school_name", "last_school_type", "last_school_barangay", "last_school_city", "last_school_province"]
    .some((field) => !canonicalFields[field])) return null;

  return { ...form, ...canonicalFields, last_school_record_id: school.id.toString() };
}

async function existingStudentVerificationMatches(form: Record<string, string>) {
  const recordId = parseAdmissionId(form.current_student_record_id);
  const selectedBranchId = parseAdmissionId(form.branch_id);

  if (recordId === null || selectedBranchId === null) return false;
  const submittedBirthDate = parseDateRange(form.current_student_birth_date);

  if (!submittedBirthDate) {
    return false;
  }

  const student = await prisma.student.findUnique({
    where: {
      id: recordId,
    },
    select: {
      studentNumber: true,
      email: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      applications: {
        where: {
          branchId: selectedBranchId,
        },
        orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          branchId: true,
        },
      },
    },
  });

  if (!student) {
    return false;
  }

  const latestApplication = student.applications[0];

  if (!latestApplication) {
    return false;
  }

  return (
    normalizeText(student.studentNumber) === form.current_student_number &&
    student.email.toLowerCase() === form.current_student_email.toLowerCase() &&
    normalizeName(student.firstName).toLowerCase() ===
      normalizeName(form.current_student_first_name).toLowerCase() &&
    normalizeName(student.lastName).toLowerCase() ===
      normalizeName(form.current_student_last_name).toLowerCase() &&
    student.birthDate >= submittedBirthDate.start &&
    student.birthDate < submittedBirthDate.end
  );
}

async function getCanonicalAdmissionProgramSelection(
  form: Record<string, string>
): Promise<CanonicalAdmissionProgramSelection | null> {
  const branchId = parseAdmissionId(form.branch_id);
  const programId = parseAdmissionId(form.program_id);
  const academicLevel = getAcademicLevelOption(form.academic_level);

  if (
    branchId === null ||
    programId === null ||
    !academicLevel
  ) {
    return null;
  }

  const offering = await prisma.branchProgram.findUnique({
    where: {
      branchId_programId: {
        branchId,
        programId,
      },
    },
    select: {
      branch: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
      program: {
        select: {
          id: true,
          code: true,
          label: true,
          programType: true,
        },
      },
    },
  });

  if (!offering) {
    return null;
  }

  const { branch, program } = offering;

  if (
    program.programType !== form.program_type ||
    !isAcademicLevelAllowedForProgram(program.programType, academicLevel.value)
  ) {
    return null;
  }

  return {
    branchId: branch.id,
    branchCode: branch.slug,
    branchTitle: branch.title,
    programId: program.id,
    programCode: program.code,
    programLabel: program.label,
    programType: program.programType satisfies ProgramTypeValue,
    academicLevel: academicLevel.value,
    academicLevelLabel: academicLevel.label,
  };
}

function applyCanonicalProgramSelection(
  form: Record<string, string>,
  selection: CanonicalAdmissionProgramSelection
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
    academic_level: selection.academicLevel,
    academic_level_label: selection.academicLevelLabel,
  };
}

export async function verifyCurrentStudent(
  input: VerifyCurrentStudentInput
): Promise<VerifyCurrentStudentResult> {
  const branchId = sanitizeInputText(input.branchId);
  const studentNumber = sanitizeInputText(input.studentNumber);
  const studentEmail = normalizeEmail(sanitizeInputText(input.studentEmail));
  const firstName = capitalizeInputText(input.firstName);
  const lastName = capitalizeInputText(input.lastName);
  const birthDate = sanitizeInputText(input.birthDate);

  if (
    !branchId ||
    !studentNumber ||
    !studentEmail ||
    !firstName ||
    !lastName ||
    !birthDate
  ) {
    return {
      verified: false,
      message: MISSING_FIELDS_MESSAGE,
    };
  }

  const selectedBranchId = parseAdmissionId(branchId);

  if (selectedBranchId === null) {
    return {
      verified: false,
      message: "Select a valid branch before checking the record.",
    };
  }

  const birthDateRange = parseDateRange(birthDate);

  if (!birthDateRange) {
    return {
      verified: false,
      message: "Enter a valid birth date.",
    };
  }

  try {
    const student = await prisma.student.findFirst({
      where: {
        studentNumber,
        email: {
          equals: studentEmail.replace(/[\\%_]/g, (character) => `\\${character}`),
          mode: "insensitive",
        },
        birthDate: {
          gte: birthDateRange.start,
          lt: birthDateRange.end,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        middleName: true,
        lastName: true,
        suffix: true,
        applications: {
          where: {
            branchId: selectedBranchId,
          },
          orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            branch: {
              select: {
                title: true,
              },
            },
            program: {
              select: {
                label: true,
              },
            },
            academicLevel: true,
          },
        },
      },
    });

    if (!student) {
      console.info("Current student verification failed", {
        reason: "student_not_found",
      });

      return {
        verified: false,
        message: VERIFICATION_FAILED_MESSAGE,
      };
    }

    if (
      normalizeName(student.firstName).toLowerCase() !==
        firstName.toLowerCase() ||
      normalizeName(student.lastName).toLowerCase() !== lastName.toLowerCase()
    ) {
      console.info("Current student verification failed", {
        reason: "student_name_mismatch",
      });

      return {
        verified: false,
        message: VERIFICATION_FAILED_MESSAGE,
      };
    }

    const latestApplication = student.applications[0];

    if (!latestApplication) {
      console.info("Current student verification failed", {
        reason: "student_branch_mismatch",
      });

      return {
        verified: false,
        message: VERIFICATION_FAILED_MESSAGE,
      };
    }

    const verificationMessage =
      "Student record verified. We sent a secure update link to your email.";

    try {
      await sendStudentUpdateLinkEmail({
        to: student.email,
        studentName: formatStudentName(student),
        updateUrl: await createStudentUpdateUrl(student.id.toString(), student.email),
      });
    } catch (error) {
      console.error("Failed to send student update link email:", error);

      return {
        verified: false,
        message:
          "Student record was found, but we could not send the update link email. Please contact the registrar or try again later.",
      };
    }

    return {
      verified: true,
      message: verificationMessage,
      student: {
        id: student.id.toString(),
        displayName: formatStudentName(student),
        latestAdmission: {
          branch: latestApplication.branch.title,
          program: latestApplication.program.label,
          yearLevel: formatAcademicLevel(latestApplication.academicLevel),
        },
      },
    };
  } catch (error) {
    console.error("Failed to verify student record:", error);

    return {
      verified: false,
      message: "Failed to verify the student record.",
    };
  }
}

export async function submitAdmissionApplication(
  formInput: unknown,
  consent: boolean
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

  let normalizedForm = normalizeForm(form);
  const applicantType = normalizedForm.applicant_type;

  if (applicantType !== NEW_STUDENT && applicantType !== EXISTING_STUDENT) {
    return {
      submitted: false,
      message: "Select a valid applicant type before submitting.",
    };
  }

  if (normalizedForm.last_school_record_id) {
    try {
      const canonicalSchoolForm = await applyCanonicalLastSchoolSelection(normalizedForm);
      if (!canonicalSchoolForm) {
        return { submitted: false, message: "Select a valid previous school, or choose Other school." };
      }
      normalizedForm = canonicalSchoolForm;
    } catch (error) {
      console.error("Failed to validate previous school selection:", error);
      return { submitted: false, message: "Previous schools are unavailable right now. Please try again or choose Other school." };
    }
  }

  const missingBaseField = missingRequiredField(normalizedForm, requiredFields);

  if (missingBaseField) {
    return {
      submitted: false,
      message: `${fieldLabels[missingBaseField] ?? "A required field"} is required before submitting.`,
    };
  }

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
    programSelection
  );

  if (applicantType === EXISTING_STUDENT) {
    const missingExistingField = missingRequiredField(
      normalizedForm,
      existingStudentRequiredFields
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
          message: "Current student verification details do not match our records.",
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

  const submissionId = randomUUID().replace(/\D/g, "").padEnd(8, "0").slice(0, 8);
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
      message: error instanceof LastSchoolSelectionError
        ? error.message
        : "We could not save your admission form right now. Please try again.",
    };
  }
}
