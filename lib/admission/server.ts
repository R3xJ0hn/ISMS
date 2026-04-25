import { randomUUID } from "node:crypto";

import { unstable_cache } from "next/cache";

import {
  CivilStatus,
  Gender,
  ProgramType,
  SchoolType,
  type ProgramType as ProgramTypeValue,
} from "@/lib/generated/prisma/enums";
import {
  saveAdmissionSubmission,
  type CanonicalAdmissionProgramSelection,
} from "@/lib/admission/submission-store";
import { sendStudentUpdateLinkEmail } from "@/lib/admission/resend";
import { createStudentUpdateUrl } from "@/lib/admission/student-update";
import {
  validateEmail,
  validatePhone,
  validateSchoolYear,
} from "@/lib/admission/validation";
import { prisma } from "@/lib/prisma";
import { normalizeName, normalizeText } from "@/lib/utils";

type BranchAddress = {
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

type InternalProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: Map<string, AdmissionAcademicLevelOption>;
};

const EXISTING_STUDENT = "Existing Student";
const NEW_STUDENT = "New Student";
const MISSING_FIELDS_MESSAGE =
  "Complete all verification fields before checking the record.";
const VERIFICATION_FAILED_MESSAGE = "Verification failed.";
const allowedAcademicLevelSlugsByProgramType: Record<
  ProgramTypeValue,
  readonly string[]
> = {
  [ProgramType.Bachelor]: [
    "first-year",
    "second-year",
    "third-year",
    "fourth-year",
  ],
  [ProgramType.SeniorHigh]: ["grade-11", "grade-12"],
  [ProgramType.Associate]: ["first-year", "second-year"],
};

const branchSelect = {
  id: true,
  slug: true,
  title: true,
  image: true,
  phone: true,
  facebookText: true,
  mapLink: true,
  address: {
    select: {
      houseNumber: true,
      subdivision: true,
      street: true,
      barangay: true,
      city: true,
      province: true,
      postalCode: true,
    },
  },
} as const;

const academicLevelOrder = new Map(
  [
    "grade-11",
    "grade-12",
    "first-year",
    "second-year",
    "third-year",
    "fourth-year",
  ].map((value, index) => [value, index])
);
const programTypeOrder = new Map(
  ["Bachelor", "SeniorHigh", "Associate"].map((value, index) => [value, index])
);

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

function formatAddress(address: BranchAddress | null) {
  if (!address) {
    return "";
  }

  return [
    address.houseNumber,
    address.street,
    address.subdivision,
    address.barangay,
    address.city,
    address.province,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

function normalizeForm(form: Record<string, unknown>) {
  const normalized: Record<string, string> = {};

  for (const field of allowedSubmissionFields) {
    normalized[field] = normalizeText(form[field]);
  }

  return normalized;
}

function missingRequiredField(
  form: Record<string, unknown>,
  fields: readonly string[]
) {
  return fields.find((field) => !normalizeText(form[field])) ?? null;
}

function parseDateRange(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const start = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(start.getTime()) ||
    start.getUTCFullYear() !== year ||
    start.getUTCMonth() + 1 !== month ||
    start.getUTCDate() !== day
  ) {
    return null;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function enumIncludes<T extends Record<string, string>>(
  values: T,
  value: string
) {
  return Object.values(values).includes(value);
}

function firstInvalidField(
  form: Record<string, string>,
  applicantType: string
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
      validate: (value) => parseDateRange(value) !== null,
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
      validate: (value) => parseDateRange(value) !== null,
      when: Boolean(form.last_school_graduation_date),
    },
    {
      field: "current_student_email",
      validate: validateEmail,
      when: applicantType === EXISTING_STUDENT,
    },
    {
      field: "current_student_birth_date",
      validate: (value) => parseDateRange(value) !== null,
      when: applicantType === EXISTING_STUDENT,
    },
  ];

  return (
    validations.find(
      ({ field, validate, when = true }) => when && !validate(form[field] ?? "")
    )?.field ?? null
  );
}

function sortAcademicLevels(
  left: { label: string; slug: string },
  right: { label: string; slug: string }
) {
  const orderDifference =
    (academicLevelOrder.get(left.slug) ?? Number.MAX_SAFE_INTEGER) -
    (academicLevelOrder.get(right.slug) ?? Number.MAX_SAFE_INTEGER);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return left.label.localeCompare(right.label);
}

function sortPrograms(left: InternalProgramOption, right: InternalProgramOption) {
  const typeDifference =
    (programTypeOrder.get(left.programType) ?? Number.MAX_SAFE_INTEGER) -
    (programTypeOrder.get(right.programType) ?? Number.MAX_SAFE_INTEGER);

  if (typeDifference !== 0) {
    return typeDifference;
  }

  return left.label.localeCompare(right.label);
}

function formatDisplayName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

const getCachedBranches = unstable_cache(
  async () => {
    const branches = await prisma.branch.findMany({
      orderBy: {
        title: "asc",
      },
      select: branchSelect,
    });

    return branches.map(({ id, slug, address, ...branch }) => ({
      ...branch,
      id: id.toString(),
      code: slug,
      address,
      formattedAddress: formatAddress(address),
    }));
  },
  ["admission-branches"],
  {
    revalidate: 300,
  }
);

async function existingStudentVerificationMatches(form: Record<string, string>) {
  const recordId = form.current_student_record_id;

  if (!/^\d+$/.test(recordId)) {
    return false;
  }

  const submittedBirthDate = parseDateRange(form.current_student_birth_date);

  if (!submittedBirthDate) {
    return false;
  }

  const student = await prisma.student.findUnique({
    where: {
      id: BigInt(recordId),
    },
    select: {
      studentNumber: true,
      email: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      enrollments: {
        orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
        take: 1,
        select: {
          schoolYear: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
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

export async function getAdmissionBranches(): Promise<AdmissionBranchesResult> {
  try {
    return {
      branches: await getCachedBranches(),
    };
  } catch (error) {
    console.error("Failed to fetch branches:", error);

    return {
      branches: [],
      error: "Failed to fetch branches.",
    };
  }
}

export async function getAdmissionProgramOptions(
  branchId: string
): Promise<AdmissionProgramOptionsResult> {
  const normalizedBranchId = normalizeText(branchId);

  if (!/^\d+$/.test(normalizedBranchId)) {
    return {
      programs: [],
      error: "A valid branchId is required.",
    };
  }

  try {
    const [branch, programs, academicLevels] = await Promise.all([
      prisma.branch.findUnique({
        where: {
          id: BigInt(normalizedBranchId),
        },
        select: {
          id: true,
          slug: true,
          title: true,
        },
      }),
      prisma.program.findMany({
        select: {
          id: true,
          code: true,
          label: true,
          programType: true,
        },
      }),
      prisma.academicLevels.findMany({
        select: {
          id: true,
          label: true,
          slug: true,
        },
      }),
    ]);

    if (!branch) {
      return {
        programs: [],
        error: "Branch not found.",
      };
    }

    const programOptions = programs
      .map((program): InternalProgramOption => {
        const allowedSlugs = allowedAcademicLevelSlugsByProgramType[
          program.programType
        ];

        return {
          id: program.id.toString(),
          code: program.code,
          label: program.label,
          programType: program.programType,
          academicLevels: new Map(
            academicLevels
              .filter((level) => allowedSlugs.includes(level.slug))
              .map((level) => [
                level.id.toString(),
                {
                  id: level.id.toString(),
                  label: level.label,
                  slug: level.slug,
                },
              ])
          ),
        };
      })
      .toSorted(sortPrograms)
      .map(({ academicLevels, ...program }) => ({
        ...program,
        academicLevels: Array.from(academicLevels.values()).toSorted(
          sortAcademicLevels
        ),
      }));

    return {
      branch: {
        id: branch.id.toString(),
        title: branch.title,
        code: branch.slug,
      },
      programs: programOptions,
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
  form: Record<string, string>
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

  const [branch, program, academicLevel] = await Promise.all([
    prisma.branch.findUnique({
      where: {
        id: BigInt(branchId),
      },
      select: {
        id: true,
        slug: true,
        title: true,
      },
    }),
    prisma.program.findUnique({
      where: {
        id: BigInt(programId),
      },
      select: {
        id: true,
        code: true,
        label: true,
        programType: true,
      },
    }),
    prisma.academicLevels.findUnique({
      where: {
        id: BigInt(academicLevelsId),
      },
      select: {
        id: true,
        label: true,
        slug: true,
      },
    }),
  ]);

  if (!branch || !program || !academicLevel) {
    return null;
  }

  const allowedAcademicLevelSlugs =
    allowedAcademicLevelSlugsByProgramType[program.programType];

  if (
    program.programType !== form.program_type ||
    !allowedAcademicLevelSlugs.includes(academicLevel.slug)
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
    academicLevelsId: academicLevel.id,
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
    academic_level_id: selection.academicLevelsId.toString(),
    academic_level_label: selection.academicLevelLabel,
  };
}

export async function verifyCurrentStudent(
  input: VerifyCurrentStudentInput
): Promise<VerifyCurrentStudentResult> {
  const studentNumber = normalizeText(input.studentNumber);
  const studentEmail = normalizeText(input.studentEmail);
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  const birthDate = normalizeText(input.birthDate);

  if (
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
          equals: studentEmail,
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
        enrollments: {
          orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
          take: 1,
          select: {
            schoolYear: {
              select: {
                name: true,
              },
            },
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
            academicLevels: {
              select: {
                label: true,
              },
            },
            section: {
              select: {
                sectionCode: true,
                sectionName: true,
              },
            },
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

    const latestEnrollment = student.enrollments[0];

    let verificationMessage =
      "Student record verified. We sent a secure update link to your email.";

    try {
      await sendStudentUpdateLinkEmail({
        to: student.email,
        studentName: formatDisplayName(student),
        updateUrl: createStudentUpdateUrl(student.id.toString()),
      });
    } catch (error) {
      console.error("Failed to send student update link email:", error);
      verificationMessage =
        "Student record verified. We could not send the update link right now.";
    }

    return {
      verified: true,
      message: verificationMessage,
      student: {
        id: student.id.toString(),
        displayName: formatDisplayName(student),
        latestEnrollment: latestEnrollment
          ? {
              schoolYear: latestEnrollment.schoolYear.name,
              branch: latestEnrollment.branch.title,
              program: latestEnrollment.program.label,
              yearLevel: latestEnrollment.academicLevels.label,
              section:
                latestEnrollment.section?.sectionName ??
                latestEnrollment.section?.sectionCode ??
                null,
            }
          : null,
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

  const normalizedForm = normalizeForm(form);
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
      form,
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

  const submissionId = `ADM-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
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
      message: "We could not save your admission form right now. Please try again.",
    };
  }
}
