import "server-only";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { formatAcademicLevel } from "@/lib/academic-levels";
import { ApplicationStatus, UserRole } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";
import { findStudentByEmail } from "@/lib/portal/student";
import { createAdmissionUpdatedNotification } from "@/lib/notifications";
import { literalInsensitiveEquality, normalizeEmail, parseRecordId } from "@/lib/utils";
import { parseDateInput, validateSchoolYear } from "@/lib/validation";
import { LastSchoolSelectionError, resolveLastSchool, runLastSchoolTransaction } from "./last-school-store";
import { hasCompleteLastSchoolIdentity } from "./last-school-identity";
import { studentProfileFromRecord, studentUpdateSelect } from "./records";
import { saveStudentAddress, saveStudentGuardian } from "./student-relations";
import {
  addressDataFromProfile,
  firstInvalidStudentUpdateField,
  guardianDataFromProfile,
  lastSchoolFieldsFromRecord,
  normalizeStudentUpdateInput,
  studentDataFromProfile,
  studentUpdateFields,
  type StudentUpdateField,
  type UpdateStudentRecordInput,
} from "./student-fields";

const reviewSelect = {
  ...studentUpdateSelect,
  studentNumber: true,
  addressId: true,
  guardians: {
    ...studentUpdateSelect.guardians,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { ...studentUpdateSelect.guardians.select, id: true, guardianId: true },
  },
} as const satisfies Prisma.StudentSelect;

type ReviewStudent = Prisma.StudentGetPayload<{ select: typeof reviewSelect }>;

export type StudentAdmissionReviewRecord = {
  applicationId: string;
  studentNumber: string | null;
  lastSchoolRecordId?: string;
  profile: Record<StudentUpdateField, string>;
  branch: string;
  program: string;
  academicLevel: string;
  status: "reviewing";
};

export type StudentAdmissionReviewState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<StudentUpdateField, string>>;
};

/** Only the latest application determines the landing page, including after a later approval. */
export async function studentNeedsAdmissionReview(email: string): Promise<boolean> {
  const student = await findStudentByEmail(email, {
    applications: {
      orderBy: studentUpdateSelect.applications.orderBy,
      take: 1,
      select: { applicationStatus: true },
    },
  });
  return student?.applications[0]?.applicationStatus === ApplicationStatus.reviewing;
}

function profileFromStudent(student: ReviewStudent) {
  const profile = studentProfileFromRecord(student, student.applications[0], student.guardians[0]);
  return Object.fromEntries(studentUpdateFields.map((field) => [field, profile[field] ?? ""])) as Record<StudentUpdateField, string>;
}

/** There is no route or submitted identity that can select another student's information. */
export async function getStudentAdmissionReview(): Promise<StudentAdmissionReviewRecord | null> {
  const session = await requireSession();
  if (session.role !== UserRole.student) redirect("/portal");
  const student = await findStudentByEmail(session.email, reviewSelect);
  const application = student?.applications[0];
  if (!student || application?.applicationStatus !== ApplicationStatus.reviewing) return null;
  return {
    applicationId: application.id.toString(),
    studentNumber: student.studentNumber,
    lastSchoolRecordId: application.lastSchoolId && application.lastSchool?.verificationStatus === "verified" && hasCompleteLastSchoolIdentity(application.lastSchool)
      ? application.lastSchoolId.toString() : undefined,
    profile: profileFromStudent(student),
    branch: application.branch.title,
    program: application.program.label,
    academicLevel: formatAcademicLevel(application.academicLevel),
    status: "reviewing",
  };
}

class ReviewUnavailableError extends Error {}
class ReviewFieldError extends Error {
  constructor(readonly field: StudentUpdateField, message: string) { super(message); }
}

/** Selected school details are reloaded inside the same transaction as the profile save. */
async function canonicalReviewSchool(
  tx: Prisma.TransactionClient,
  profile: UpdateStudentRecordInput,
  submittedRecordId: FormDataEntryValue | null,
) {
  if (submittedRecordId === null || submittedRecordId === "") {
    // Other school has no inputs for these values. Never copy them from a different saved school.
    return { ...profile, lastSchoolId: "", lastSchoolHouseNumber: "", lastSchoolSubdivision: "" };
  }

  const recordId = typeof submittedRecordId === "string"
    ? parseRecordId(submittedRecordId, { canonical: true, maxDigits: 19 }) : null;
  if (recordId === null) throw new LastSchoolSelectionError();
  const school = await tx.lastSchool.findUnique({
    where: { id: recordId },
    select: studentUpdateSelect.applications.select.lastSchool.select,
  });
  if (school?.verificationStatus !== "verified" || !hasCompleteLastSchoolIdentity(school)) throw new LastSchoolSelectionError();

  return normalizeStudentUpdateInput({
    ...profile,
    ...lastSchoolFieldsFromRecord(school),
  });
}

/** Save only editable profile details while the authenticated student's latest admission is reviewing. */
export async function saveStudentAdmissionReview(formData: FormData): Promise<StudentAdmissionReviewState> {
  const session = await requireSession();
  if (session.role !== UserRole.student) redirect("/portal");
  const userId = parseRecordId(session.id, { canonical: true, maxDigits: 19 });
  const expectedApplication = formData.get("applicationId");
  const applicationId = typeof expectedApplication === "string"
    ? parseRecordId(expectedApplication, { canonical: true, maxDigits: 19 }) : null;
  if (userId === null || applicationId === null) {
    return { success: false, message: "Your admission information changed. Reload this page before saving." };
  }

  let saveStage = "load-account";
  try {
    await runLastSchoolTransaction(async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, emailVerified: true, sessionVersion: true },
      });
      if (!account || account.email !== session.email || account.role !== UserRole.student ||
        !account.emailVerified || account.sessionVersion !== session.sessionVersion) throw new ReviewUnavailableError();

      saveStage = "load-student";
      const students = await tx.student.findMany({
        where: { email: literalInsensitiveEquality(normalizeEmail(account.email)) }, select: reviewSelect, take: 2,
      });
      const student = students.length === 1 ? students[0] : null;
      const application = student?.applications[0];
      if (!student || !application || application.id !== applicationId ||
        application.applicationStatus !== ApplicationStatus.reviewing) throw new ReviewUnavailableError();

      const baseline = profileFromStudent(student);
      const submittedProfile = normalizeStudentUpdateInput(Object.fromEntries(studentUpdateFields.map((field) => [
        field, field === "email" ? baseline[field] : formData.get(field),
      ])) as UpdateStudentRecordInput);
      const schoolRecordId = formData.get("lastSchoolRecordId");
      saveStage = "load-school";
      const profile = await canonicalReviewSchool(tx, submittedProfile, schoolRecordId);
      const invalidField = firstInvalidStudentUpdateField(profile);
      if (invalidField) throw new ReviewFieldError(invalidField, "Complete this field with valid information.");
      if (!validateSchoolYear(profile.lastSchoolYear)) {
        throw new ReviewFieldError("lastSchoolYear", "Choose a valid school year.");
      }
      const graduationDate = profile.lastSchoolGraduationDate ? parseDateInput(profile.lastSchoolGraduationDate) : null;
      if (profile.lastSchoolGraduationDate && !graduationDate) {
        throw new ReviewFieldError("lastSchoolGraduationDate", "Enter a valid graduation date.");
      }
      const birthDate = parseDateInput(profile.birthDate);
      if (!birthDate) throw new ReviewFieldError("birthDate", "Enter a valid birth date.");

      saveStage = "save-address";
      const addressId = await saveStudentAddress(tx, student.addressId, addressDataFromProfile(profile, "address"));
      saveStage = "save-guardian";
      await saveStudentGuardian(tx, student.id, student.guardians[0], guardianDataFromProfile(profile), profile.guardianRelationship);
      saveStage = "save-school";
      const lastSchool = await resolveLastSchool(tx, profile, typeof schoolRecordId === "string" ? schoolRecordId : undefined);
      saveStage = "save-admission";
      const savedApplication = await tx.admissionApplication.updateMany({
        where: { id: application.id, studentId: student.id, applicationStatus: ApplicationStatus.reviewing },
        data: {
          applicationStatus: ApplicationStatus.updated,
          lastSchoolId: lastSchool.id,
          LSSchoolYearEnd: profile.lastSchoolYear,
          LSAttainedLevelText: profile.lastSchoolYearLevel,
          LSGraduationDate: graduationDate,
        },
      });
      if (savedApplication.count !== 1) throw new ReviewUnavailableError();
      const studentData = studentDataFromProfile(profile, birthDate);
      // Account identity stays unchanged even when a crafted form supplies another email.
      const { email: _email, ...editableStudentData } = studentData;
      void _email;
      saveStage = "save-student";
      await tx.student.update({
        where: { id: student.id }, data: { ...editableStudentData, addressId }, select: { id: true },
      });
      saveStage = "save-notification";
      await createAdmissionUpdatedNotification(tx, { applicationId: application.id, actorUserId: account.id });
    });
  } catch (error) {
    if (error instanceof LastSchoolSelectionError) {
      return {
        success: false, message: "Select a saved school, or choose Other and enter its details.",
        fieldErrors: { lastSchoolName: "This saved school is unavailable. Select a school again, or choose Other." },
      };
    }
    if (error instanceof ReviewFieldError) {
      return { success: false, message: "Check the indicated field before saving.", fieldErrors: { [error.field]: error.message } };
    }
    if (error instanceof ReviewUnavailableError) {
      return { success: false, message: "Your admission information changed or is no longer under review. Reload this page before saving." };
    }
    const details = (typeof error === "object" && error !== null ? error : {}) as { code?: unknown; meta?: { code?: unknown } };
    const safeCode = (value: unknown) => typeof value === "string" && /^[A-Z0-9_]{1,40}$/.test(value) ? value : "UNKNOWN";
    console.error("Failed to save the signed-in student's admission review.", {
      stage: saveStage, code: safeCode(details.code), databaseCode: safeCode(details.meta?.code),
    });
    return { success: false, message: "We could not save your information right now. Please try again." };
  }

  for (const path of ["/portal/admission-review", "/portal/information", "/portal/admission", "/portal/students", "/portal/dashboard"]) {
    revalidatePath(path);
  }
  revalidatePath("/portal", "layout");
  revalidatePath(`/portal/admission/${applicationId}/edit`);
  revalidatePath(`/portal/students/${applicationId}`);
  revalidatePath(`/portal/students/${applicationId}/edit`);
  return { success: true, message: "Your information has been saved and sent to the administrator for review." };
}
