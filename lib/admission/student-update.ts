import { studentProfileFromRecord, studentUpdateSelect, type StudentUpdateQueryResult } from "@/lib/admission/records";
import { parseDateInput, validateEmail } from "@/lib/validation";
import { addressDataFromProfile, firstInvalidStudentUpdateField, guardianDataFromProfile, normalizeStudentUpdateInput, studentDataFromProfile, type UpdateStudentRecordInput } from "./student-fields";
import { resolveLastSchool, runLastSchoolTransaction } from "./last-school-store";
import { formatAcademicLevel } from "@/lib/academic-levels";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { normalizeEmail, parseId } from "@/lib/utils";

import {
  ApplicationStatus,
  UserRole,
  VerificationTokenPurpose,
} from "@/lib/generated/prisma/enums";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export { studentUpdateFields, type UpdateStudentRecordInput } from "./student-fields";

const STUDENT_UPDATE_LINK_TTL_MS = 1000 * 60 * 60;

export type StudentUpdateTokenPayload = {
  scope: "student-update";
  studentId: string;
  jti: string;
  exp: number;
  userId?: string;
  email?: string;
  sessionVersion?: number;
};

export type StudentUpdateRecord = ReturnType<typeof mapStudentRecord>;

function getStudentUpdateLinkSecret() {
  const secret =
    process.env.STUDENT_UPDATE_LINK_SECRET ?? process.env.RESEND_API_KEY;

  if (!secret) {
    throw new Error(
      "STUDENT_UPDATE_LINK_SECRET or RESEND_API_KEY must be configured."
    );
  }

  return secret;
}

function signStudentUpdateToken(encodedPayload: string) {
  return createHmac("sha256", getStudentUpdateLinkSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function verifyStudentUpdateToken(token: string) {
  if (!token || token.length > 4096) return null;
  const parts = token.split(".");
  const [encodedPayload, signature] = parts;

  if (parts.length !== 2 || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signStudentUpdateToken(encodedPayload);
  const providedSignature = Buffer.from(signature);
  const calculatedSignature = Buffer.from(expectedSignature);

  if (
    providedSignature.length !== calculatedSignature.length ||
    !timingSafeEqual(providedSignature, calculatedSignature)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as StudentUpdateTokenPayload;

    if (
      payload.scope !== "student-update" ||
      typeof payload.studentId !== "string" ||
      parseId(payload.studentId) === null ||
      BigInt(payload.studentId) <= 0n ||
      BigInt(payload.studentId) > 9223372036854775807n ||
      typeof payload.jti !== "string" ||
      !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(payload.jti) ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= Date.now()
    ) {
      return null;
    }

    const hasAccountClaims = payload.userId !== undefined || payload.email !== undefined;
    if (hasAccountClaims && (
      typeof payload.userId !== "string" || !/^[1-9]\d*$/.test(payload.userId) ||
      BigInt(payload.userId) > 9223372036854775807n ||
      typeof payload.email !== "string" || payload.email.length > 320 ||
      payload.email !== normalizeEmail(payload.email) || !validateEmail(payload.email)
    )) return null;
    if (payload.sessionVersion !== undefined && (typeof payload.sessionVersion !== "number" ||
      !Number.isSafeInteger(payload.sessionVersion) || payload.sessionVersion < 0 || payload.sessionVersion > 2147483647)) return null;

    return payload;
  } catch {
    return null;
  }
}

function normalizeAppBaseUrl(value: string) {
  const url = new URL(value.trim());
  const allowHttp = process.env.NODE_ENV === "development";

  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("APP_URL must use HTTPS outside development.");
  }

  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
}

function getAppBaseUrl() {
  if (process.env.APP_URL) {
    return normalizeAppBaseUrl(process.env.APP_URL);
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return normalizeAppBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  }

  if (process.env.VERCEL_URL) {
    return normalizeAppBaseUrl(`https://${process.env.VERCEL_URL}`);
  }

  return normalizeAppBaseUrl("http://localhost:3000");
}

function mapStudentRecord(
  token: string,
  student: StudentUpdateQueryResult
) {
  const primaryGuardian =
    student.guardians.find((guardian) => guardian.isPrimary) ??
    student.guardians[0];
  const latestApplication = student.applications[0];

  return {
    token,
    studentId: student.id.toString(),
    ...studentProfileFromRecord(student, latestApplication, primaryGuardian),
    latestAdmissionStatus: latestApplication?.applicationStatus ?? "",
    latestAdmissionBranch: latestApplication?.branch.title ?? "",
    latestAdmissionProgram: latestApplication?.program.label ?? "",
    latestAdmissionYearLevel: latestApplication
      ? formatAcademicLevel(latestApplication.academicLevel)
      : "",
  };
}

export function studentTokenWhere(payload: StudentUpdateTokenPayload) {
  return {
    jti: payload.jti, purpose: VerificationTokenPurpose.studentUpdate,
    employeeId: null,
    ...(payload.userId ? { userId: BigInt(payload.userId) } : {}),
    consumedAt: null, expiresAt: { gt: new Date() },
  };
}

export async function createStudentUpdateUrl(studentId: string, recipientEmail: string) {
  const id = parseId(studentId);
  if (id === null || id <= 0n || id > 9223372036854775807n) throw new Error("Invalid student ID.");
  const email = normalizeEmail(recipientEmail);
  if (!validateEmail(email) || email.length > 320) throw new Error("Invalid student email.");
  const updateUrl = new URL("/admission/update", getAppBaseUrl());
  const token = await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id }, select: { email: true, userImage: true } });
    if (!student || normalizeEmail(student.email) !== email) throw new Error("The student email changed. Request a new link.");
    let user = await tx.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, role: true, sessionVersion: true },
    });
    if (user && user.role !== UserRole.student) throw new Error("This email belongs to another portal account.");
    if (!user) {
      user = await tx.user.create({
        data: { email, role: UserRole.student, passwordHash: "!password-setup-required", emailVerified: false, sessionVersion: 0, userImage: student.userImage ?? null },
        select: { id: true, role: true, sessionVersion: true },
      });
    }
    const expiresAt = new Date(Date.now() + STUDENT_UPDATE_LINK_TTL_MS);
    const payload: StudentUpdateTokenPayload = {
      scope: "student-update", studentId, userId: user.id.toString(), email, sessionVersion: user.sessionVersion,
      jti: randomUUID(), exp: expiresAt.getTime(),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signed = `${encodedPayload}.${signStudentUpdateToken(encodedPayload)}`;
    await tx.verificationToken.create({
      data: { jti: payload.jti, userId: user.id, purpose: VerificationTokenPurpose.studentUpdate, expiresAt },
    });
    return signed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  updateUrl.searchParams.set("token", token);

  return updateUrl.toString();
}

export async function getStudentUpdateRecord(token: string) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return null;
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: studentTokenWhere(payload), select: { userId: true },
  });
  if (!tokenRecord || tokenRecord.userId === null) return null;

  const student = await prisma.student.findUnique({
    where: {
      id: BigInt(payload.studentId),
    },
    select: studentUpdateSelect,
  });

  if (!student) {
    return null;
  }

  const account = await prisma.user.findUnique({ where: { id: tokenRecord.userId }, select: { email: true, role: true } });
  if (!account || account.role !== UserRole.student || normalizeEmail(account.email) !== normalizeEmail(student.email)) return null;

  return mapStudentRecord(token, student);
}

export async function updateStudentRecordFromToken(
  token: string,
  input: UpdateStudentRecordInput
) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return {
      success: false,
      message: "This update link is invalid or has expired.",
    };
  }

  const normalizedInput = normalizeStudentUpdateInput(input);
  normalizedInput.email = normalizeEmail(normalizedInput.email);
  const invalidField = firstInvalidStudentUpdateField(normalizedInput);

  if (invalidField) {
    return {
      success: false,
      message: "Complete the required fields with valid information.",
    };
  }

  const birthDate = parseDateInput(normalizedInput.birthDate);

  if (!birthDate) {
    return {
      success: false,
      message: "Enter a valid birth date.",
    };
  }

  try {
    await runLastSchoolTransaction(async (tx) => {
      const tokenRecord = await tx.verificationToken.findFirst({
        where: studentTokenWhere(payload), select: { userId: true },
      });
      if (!tokenRecord || tokenRecord.userId === null) throw new Error("Student update token is invalid or no longer available.");
      // Lock the still-valid token without consuming it; password setup uses the same link afterward.
      const validToken = await tx.verificationToken.updateMany({
        where: {
          ...studentTokenWhere(payload), userId: tokenRecord.userId,
        },
        data: { consumedAt: null },
      });
      if (validToken.count !== 1) throw new Error("Student update token is invalid or no longer available.");
      const student = await tx.student.findUnique({
        where: {
          id: BigInt(payload.studentId),
        },
        select: {
          id: true,
          email: true,
          addressId: true,
          guardians: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              id: true,
              guardianId: true,
            },
          },
          applications: {
            orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              id: true,
              applicationStatus: true,
              submittedAt: true,
            },
          },
        },
      });

      if (!student) {
        throw new Error("Student record not found.");
      }

      const latestApplication = student.applications[0];
      if (!latestApplication) {
        throw new Error("Student admission record not found.");
      }

      const account = await tx.user.findUnique({
        where: { id: tokenRecord.userId }, select: { email: true, role: true, sessionVersion: true },
      });
      if (!account || account.role !== UserRole.student || normalizeEmail(account.email) !== normalizeEmail(student.email)) {
        throw new Error("The student account changed. Request a new link.");
      }
      const updatedEmail = normalizeEmail(normalizedInput.email);
      if (updatedEmail !== normalizeEmail(account.email) && account.sessionVersion !== (payload.sessionVersion ?? 0)) {
        throw new Error("Request a current student update link before changing the account email.");
      }
      const updatedAccount = await tx.user.updateMany({
        where: { id: tokenRecord.userId, email: account.email, role: UserRole.student, sessionVersion: account.sessionVersion },
        data: { email: updatedEmail, ...(normalizeEmail(account.email) !== updatedEmail ? { emailVerified: false } : {}) },
      });
      if (updatedAccount.count !== 1) throw new Error("The student account changed.");

      const addressData = addressDataFromProfile(normalizedInput, "address");

      let addressId = student.addressId;

      if (addressId) {
        const [addressStudentCount, addressSchoolCount] = await Promise.all([
          tx.student.count({ where: { addressId } }),
          tx.lastSchool.count({ where: { addressId } }),
        ]);

        if (addressStudentCount > 1 || addressSchoolCount > 0) {
          const address = await tx.address.create({
            data: addressData,
          });
          addressId = address.id;
        } else {
          await tx.address.update({
            where: {
              id: addressId,
            },
            data: addressData,
          });
        }
      } else {
        const address = await tx.address.create({
          data: addressData,
        });
        addressId = address.id;
      }

      const primaryGuardianLink = student.guardians[0];
      const guardianData = guardianDataFromProfile(normalizedInput);

      if (primaryGuardianLink) {
        const guardianLinkCount = await tx.studentGuardian.count({
          where: {
            guardianId: primaryGuardianLink.guardianId,
          },
        });

        const guardian =
          guardianLinkCount > 1
            ? await tx.guardian.create({
                data: {
                  ...guardianData,
                  email: null,
                  addressId: null,
                  facebookAccount: null,
                },
              })
            : await tx.guardian.update({
                where: {
                  id: primaryGuardianLink.guardianId,
                },
                data: guardianData,
              });

        await tx.studentGuardian.update({
          where: {
            id: primaryGuardianLink.id,
          },
          data: {
            guardianId: guardian.id,
            relationship: normalizedInput.guardianRelationship,
            isPrimary: true,
          },
        });
      } else {
        const guardian = await tx.guardian.create({
          data: {
            ...guardianData,
            email: null,
            addressId: null,
            facebookAccount: null,
          },
        });

        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: normalizedInput.guardianRelationship,
            isPrimary: true,
          },
        });
      }

      const lastSchool = await resolveLastSchool(tx, normalizedInput);

      const shouldMarkReviewing =
        latestApplication.applicationStatus === ApplicationStatus.draft;
      await tx.admissionApplication.update({
        where: {
          id: latestApplication.id,
        },
        data: {
          lastSchoolId: lastSchool.id,
          LSSchoolYearEnd: normalizedInput.lastSchoolYear,
          LSAttainedLevelText: normalizedInput.lastSchoolYearLevel,
          ...(shouldMarkReviewing
            ? {
                applicationStatus: ApplicationStatus.reviewing,
                submittedAt: latestApplication.submittedAt ?? new Date(),
              }
            : {}),
          LSGraduationDate: normalizedInput.lastSchoolGraduationDate
            ? parseDateInput(normalizedInput.lastSchoolGraduationDate)
            : null,
        },
      });

      await tx.student.update({
        where: {
          id: student.id,
        },
        data: {
          ...studentDataFromProfile(normalizedInput, birthDate),
          addressId,
        },
      });
    });

    return {
      success: true,
      message: "Your student information has been updated.",
    };
  } catch {
    console.error("Failed to update student record from email link.");

    return {
      success: false,
      message: "We could not update your student information right now.",
    };
  }
}
