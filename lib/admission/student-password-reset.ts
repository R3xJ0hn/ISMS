import { hashPassword } from "@/lib/auth";
import { formatStudentName, normalizeEmail } from "@/lib/utils";
import { getPasswordValidationError } from "@/lib/validation";

import { Prisma } from "@/lib/generated/prisma/client";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { studentTokenWhere, verifyStudentUpdateToken } from "./student-update";

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

function invalidLinkResult() {
  return { success: false, message: "This password setup link is invalid or has expired." };
}

export async function getStudentUpdatePasswordRecord(token: string) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return null;
  }

  const tokenRecord = await prisma.verificationToken.findFirst({
    where: studentTokenWhere(payload),
    select: { userId: true },
  });

  if (!tokenRecord || tokenRecord.userId === null) return null;

  const student = await prisma.student.findUnique({
    where: {
      id: BigInt(payload.studentId),
    },
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      email: true,
    },
  });

  if (!student) {
    return null;
  }

  const account = await prisma.user.findUnique({ where: { id: tokenRecord.userId }, select: { email: true, role: true, sessionVersion: true } });
  if (!account || account.role !== UserRole.student || normalizeEmail(account.email) !== normalizeEmail(student.email) ||
    account.sessionVersion !== (payload.sessionVersion ?? 0) || account.sessionVersion >= 2147483647) return null;

  return {
    token,
    studentId: student.id.toString(),
    displayName: formatStudentName(student),
    email: student.email,
  } satisfies StudentUpdatePasswordRecord;
}

export async function setStudentPortalPasswordFromToken(
  token: string,
  input: SetStudentPasswordInput
) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return invalidLinkResult();
  }

  const password = input.password;
  const passwordError = getPasswordValidationError(password, input.confirmPassword);
  if (passwordError) {
    return {
      success: false,
      message: passwordError,
    };
  }
  if (new TextEncoder().encode(password).length > 72) {
    return { success: false, message: "Password must be no more than 72 UTF-8 bytes." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.verificationToken.findFirst({
        where: studentTokenWhere(payload), select: { userId: true },
      });
      if (!tokenRecord || tokenRecord.userId === null) return invalidLinkResult();

      const student = await tx.student.findUnique({
        where: { id: BigInt(payload.studentId) }, select: { email: true },
      });
      if (!student) return { success: false, message: "Student record not found." };

      const email = normalizeEmail(student.email);
      const existingUser = await tx.user.findUnique({
        where: { id: tokenRecord.userId },
        select: { id: true, email: true, role: true, emailVerified: true, passwordHash: true, sessionVersion: true },
      });
      if (!existingUser || existingUser.role !== UserRole.student || normalizeEmail(existingUser.email) !== email ||
        existingUser.sessionVersion !== (payload.sessionVersion ?? 0) || existingUser.sessionVersion >= 2147483647) {
        return { success: false, message: "The student account changed. Request a new password setup link." };
      }
      const passwordHash = await hashPassword(password);

      const consumedToken = await tx.verificationToken.updateMany({
        where: { ...studentTokenWhere(payload), userId: tokenRecord.userId },
        data: { consumedAt: new Date() },
      });

      if (consumedToken.count !== 1) {
        throw new Error("Student update token was already consumed.");
      }

      const provesCurrentEmail = payload.email !== undefined && payload.email === email;
      const updatedUser = await tx.user.updateMany({
        where: { id: existingUser.id, email: existingUser.email, role: UserRole.student,
          passwordHash: existingUser.passwordHash, sessionVersion: existingUser.sessionVersion },
        data: { passwordHash, emailVerified: provesCurrentEmail || existingUser.emailVerified, sessionVersion: { increment: 1 } },
      });
      if (updatedUser.count !== 1) throw new Error("Student account changed while setting its password.");
      return { success: true, message: "Your portal password has been set." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    console.error("Failed to set student portal password.");

    return {
      success: false,
      message: "We could not set your password right now.",
    };
  }
}
