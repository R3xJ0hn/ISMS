import { createStudentUpdateUrl } from "../admission/student-update";
import {
  VerifyCurrentStudentInput,
  VerifyCurrentStudentResult,
} from "../types";
import { sendEmail } from "../emailer";
import { buildStudentUpdateEmail } from "../templates/email-student-update";
import {
  formatDisplayName,
  normalizeName,
  normalizeFormWithNormalizers,
  normalizeText,
  parseDateInput,
} from "../utils";
import { findStudentForAdmissionVerification } from "./admission";

const MESSAGES = {
  incomplete: "Complete all verification fields before checking the record.",
  invalidBranch: "Select a valid branch before checking the record.",
  invalidBirthDate: "Enter a valid birth date.",
  failed: "Verification failed.",
  verifyError: "Failed to verify the student record.",
  emailFailed:
    "Student record was found, but we could not send the update link email. Please contact the registrar or try again later.",
  verified:
    "Student record verified. We sent a secure update link to your email.",
} as const;

function failed(message: string): VerifyCurrentStudentResult {
  return {
    verified: false,
    message,
  };
}

const studentVerificationNormalizers = {
  branchId: normalizeText,
  studentNumber: normalizeText,
  studentEmail: normalizeText,
  firstName: normalizeName,
  lastName: normalizeName,
  birthDate: normalizeText,
} satisfies Record<keyof VerifyCurrentStudentInput, (value: unknown) => string>;

function hasCompleteInput(
  input: ReturnType<
    typeof normalizeFormWithNormalizers<
      VerifyCurrentStudentInput,
      keyof VerifyCurrentStudentInput
    >
  >,
) {
  return Object.values(input).every(Boolean);
}


function isSameName(studentName: string, inputName: string) {
  return normalizeName(studentName).toLowerCase() === inputName.toLowerCase();
}

function buildStudentSummary(student: Awaited<ReturnType<typeof findStudentForAdmissionVerification>>) {
  if (!student) {
    return null;
  }

  const latestEnrollment = student.enrollments[0];
  const latestApplication = student.applications[0];

  if (latestEnrollment) {
    return {
      schoolYear: latestEnrollment.schoolYear.name,
      branch: latestEnrollment.branch.title,
      program: latestEnrollment.program.label,
      yearLevel: latestEnrollment.academicLevels.label,
      section:
        latestEnrollment.section?.sectionName ??
        latestEnrollment.section?.sectionCode ??
        null,
    };
  }

  if (latestApplication) {
    return {
      schoolYear: null,
      branch: latestApplication.branch.title,
      program: latestApplication.program.label,
      yearLevel: latestApplication.academicLevels.label,
      section: null,
    };
  }

  return null;
}

async function sendStudentUpdateEmail(student: NonNullable<Awaited<ReturnType<typeof findStudentForAdmissionVerification>>>) {
  const updateUrl = await createStudentUpdateUrl(student.id.toString());

  const email = buildStudentUpdateEmail({
    studentName: formatDisplayName(student),
    updateUrl,
  });

  await sendEmail({
    to: student.email,
    ...email,
  });
}

export async function verifyCurrentStudent(
  input: VerifyCurrentStudentInput,
): Promise<VerifyCurrentStudentResult> {
  const normalizedInput = normalizeFormWithNormalizers(
    input,
    studentVerificationNormalizers,
  );

  if (!hasCompleteInput(normalizedInput)) {
    return failed(MESSAGES.incomplete);
  }

  if (!/^\d+$/.test(normalizedInput.branchId)) {
    return failed(MESSAGES.invalidBranch);
  }

  const birthDate = parseDateInput(normalizedInput.birthDate);

  if (!birthDate) {
    return failed(MESSAGES.invalidBirthDate);
  }

  try {
    const student = await findStudentForAdmissionVerification({
      branchId: BigInt(normalizedInput.branchId),
      studentNumber: normalizedInput.studentNumber,
      studentEmail: normalizedInput.studentEmail,
      birthDate,
    });

    if (!student) {
      console.info("Current student verification failed", {
        reason: "student_not_found",
      });

      return failed(MESSAGES.failed);
    }

    const isNameMatch =
      isSameName(student.firstName, normalizedInput.firstName) &&
      isSameName(student.lastName, normalizedInput.lastName);

    if (!isNameMatch) {
      console.info("Current student verification failed", {
        reason: "student_name_mismatch",
      });

      return failed(MESSAGES.incomplete);
    }

    const latestEnrollment = student.enrollments[0];
    const latestApplication = student.applications[0];

    if (!latestEnrollment && !latestApplication) {
      console.info("Current student verification failed", {
        reason: "student_branch_mismatch",
      });

      return failed(MESSAGES.failed);
    }

    try {
      await sendStudentUpdateEmail(student);
    } catch (error) {
      console.error("Failed to send student update link email:", error);
      return failed(MESSAGES.emailFailed);
    }

    return {
      verified: true,
      message: MESSAGES.verified,
      student: {
        id: student.id.toString(),
        displayName: formatDisplayName(student),
        latestEnrollment: buildStudentSummary(student),
      },
    };
  } catch (error) {
    console.error("Failed to verify student record:", error);
    return failed(MESSAGES.verifyError);
  }
}
