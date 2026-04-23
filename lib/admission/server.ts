import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";

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
  lastSchoolYearAttended?: string;
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
const storagePath = path.join(
  process.cwd(),
  "data",
  "admission-submissions.jsonl"
);

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
  "current_last_school_year_attended",
  "current_student_record_id",
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
  current_last_school_year_attended: "Last school year attended",
  current_student_record_id: "Verified student record",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[+]?[\d\s()\-]{7,20}$/;
const schoolYearPattern = /^(\d{4})(?:\s*-\s*(\d{4}))?$/;

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

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeName(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeForm(form: Record<string, unknown>) {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(form)) {
    normalized[key] = normalizeText(value);
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

function isValidEmail(value: string) {
  return emailPattern.test(value);
}

function isValidPhone(value: string) {
  if (!phonePattern.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isValidSchoolYear(value: string) {
  const match = schoolYearPattern.exec(value);

  if (!match) {
    return false;
  }

  const startYear = Number.parseInt(match[1], 10);
  const endYear = match[2] ? Number.parseInt(match[2], 10) : null;

  if (Number.isNaN(startYear) || startYear < 1900 || startYear > 2100) {
    return false;
  }

  if (endYear === null) {
    return true;
  }

  return endYear === startYear + 1;
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
      validate: isValidEmail,
    },
    {
      field: "contact_phone",
      validate: isValidPhone,
    },
    {
      field: "guardian_contact_number",
      validate: isValidPhone,
    },
    {
      field: "student_birth_date",
      validate: (value) => parseDateRange(value) !== null,
    },
    {
      field: "last_school_year",
      validate: isValidSchoolYear,
    },
    {
      field: "last_school_graduation_date",
      validate: (value) => parseDateRange(value) !== null,
      when: Boolean(form.last_school_graduation_date),
    },
    {
      field: "current_student_email",
      validate: isValidEmail,
      when: applicantType === EXISTING_STUDENT,
    },
    {
      field: "current_student_birth_date",
      validate: (value) => parseDateRange(value) !== null,
      when: applicantType === EXISTING_STUDENT,
    },
    {
      field: "current_last_school_year_attended",
      validate: isValidSchoolYear,
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

  const latestEnrollment = student.enrollments[0];

  if (!latestEnrollment) {
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
    student.birthDate < submittedBirthDate.end &&
    normalizeText(latestEnrollment.schoolYear.name) ===
      form.current_last_school_year_attended
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
    const [branch, sections] = await Promise.all([
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
      prisma.section.findMany({
        where: {
          branchId: BigInt(normalizedBranchId),
        },
        select: {
          academicLevels: {
            select: {
              id: true,
              label: true,
              slug: true,
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
      }),
    ]);

    if (!branch) {
      return {
        programs: [],
        error: "Branch not found.",
      };
    }

    const programsById = new Map<string, InternalProgramOption>();

    for (const section of sections) {
      const programId = section.program.id.toString();
      const existingProgram = programsById.get(programId);

      if (existingProgram) {
        existingProgram.academicLevels.set(section.academicLevels.id.toString(), {
          id: section.academicLevels.id.toString(),
          label: section.academicLevels.label,
          slug: section.academicLevels.slug,
        });
        continue;
      }

      programsById.set(programId, {
        id: programId,
        code: section.program.code,
        label: section.program.label,
        programType: section.program.programType,
        academicLevels: new Map([
          [
            section.academicLevels.id.toString(),
            {
              id: section.academicLevels.id.toString(),
              label: section.academicLevels.label,
              slug: section.academicLevels.slug,
            },
          ],
        ]),
      });
    }

    const programs = Array.from(programsById.values())
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
      programs,
    };
  } catch (error) {
    console.error("Failed to fetch admission program options:", error);

    return {
      programs: [],
      error: "Failed to fetch admission program options.",
    };
  }
}

export async function verifyCurrentStudent(
  input: VerifyCurrentStudentInput
): Promise<VerifyCurrentStudentResult> {
  const studentNumber = normalizeText(input.studentNumber);
  const studentEmail = normalizeText(input.studentEmail);
  const firstName = normalizeName(input.firstName);
  const lastName = normalizeName(input.lastName);
  const birthDate = normalizeText(input.birthDate);
  const lastSchoolYearAttended = normalizeText(input.lastSchoolYearAttended);

  if (
    !studentNumber ||
    !studentEmail ||
    !firstName ||
    !lastName ||
    !birthDate ||
    !lastSchoolYearAttended
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
        firstName: {
          equals: firstName,
          mode: "insensitive",
        },
        lastName: {
          equals: lastName,
          mode: "insensitive",
        },
        birthDate: {
          gte: birthDateRange.start,
          lt: birthDateRange.end,
        },
      },
      select: {
        id: true,
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
      return {
        verified: false,
        message: "No matching student record was found.",
      };
    }

    const latestEnrollment = student.enrollments[0];

    if (!latestEnrollment) {
      return {
        verified: false,
        message:
          "The student record exists, but no enrollment history is available for verification.",
      };
    }

    if (latestEnrollment.schoolYear.name !== lastSchoolYearAttended) {
      return {
        verified: false,
        message: "The latest school year attended does not match our records.",
      };
    }

    return {
      verified: true,
      student: {
        id: student.id.toString(),
        displayName: formatDisplayName(student),
        latestEnrollment: {
          schoolYear: latestEnrollment.schoolYear.name,
          branch: latestEnrollment.branch.title,
          program: latestEnrollment.program.label,
          yearLevel: latestEnrollment.academicLevels.label,
          section:
            latestEnrollment.section?.sectionName ??
            latestEnrollment.section?.sectionCode ??
            null,
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
      const verified = await existingStudentVerificationMatches(normalizedForm);

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
    await mkdir(path.dirname(storagePath), { recursive: true });
    await appendFile(
      storagePath,
      `${JSON.stringify({
        submissionId,
        submittedAt,
        status: "submitted",
        consent,
        form: normalizedForm,
      })}\n`,
      "utf8"
    );

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
