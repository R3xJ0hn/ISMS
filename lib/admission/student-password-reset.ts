import { hash } from "bcryptjs";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { verifyStudentUpdateToken } from "./student-update";
import { formatDisplayName, normalizeEmail } from "../utils";
import type {
  SetStudentPasswordInput,
  StudentUpdatePasswordRecord,
} from "../types";

const PASSWORD_HASH_ROUNDS = 12;


export async function getStudentUpdatePasswordRecord(token: string) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return null;
  }

  const tokenRecord = await prisma.studentUpdateToken.findUnique({
    where: {
      jti: payload.jti,
    },
    select: {
      studentId: true,
      consumedAt: true,
      expiresAt: true,
    },
  });

  if (
    !tokenRecord ||
    tokenRecord.studentId !== BigInt(payload.studentId) ||
    tokenRecord.consumedAt ||
    tokenRecord.expiresAt <= new Date()
  ) {
    return null;
  }

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

  return {
    token,
    studentId: student.id.toString(),
    displayName: formatDisplayName(student),
    email: student.email,
  } satisfies StudentUpdatePasswordRecord;
}

export async function setStudentPortalPasswordFromToken(
  token: string,
  input: SetStudentPasswordInput
) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
    return {
      success: false,
      message: "This password setup link is invalid or has expired.",
    };
  }

  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (!password || !confirmPassword) {
    return {
      success: false,
      message: "Password and confirmation are required.",
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Password must be at least 8 characters.",
    };
  }

  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return {
      success: false,
      message:
        "Password must include uppercase and lowercase letters, a number, and a special character.",
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      message: "Passwords do not match.",
    };
  }

  try {
    const student = await prisma.student.findUnique({
      where: {
        id: BigInt(payload.studentId),
      },
      select: {
        email: true,
      },
    });

    if (!student) {
      return {
        success: false,
        message: "Student record not found.",
      };
    }

    const tokenRecord = await prisma.studentUpdateToken.findUnique({
      where: {
        jti: payload.jti,
      },
      select: {
        studentId: true,
        consumedAt: true,
        expiresAt: true,
      },
    });

    if (
      !tokenRecord ||
      tokenRecord.studentId !== BigInt(payload.studentId) ||
      tokenRecord.consumedAt ||
      tokenRecord.expiresAt <= new Date()
    ) {
      return {
        success: false,
        message: "This password setup link is invalid or has expired.",
      };
    }

    const email = normalizeEmail(student.email);
    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (existingUser && existingUser.role !== UserRole.student) {
      return {
        success: false,
        message: "This email address is already used by another portal account.",
      };
    }

    const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);

    await prisma.$transaction(async (tx) => {
      const consumedToken = await tx.studentUpdateToken.updateMany({
        where: {
          jti: payload.jti,
          studentId: BigInt(payload.studentId),
          consumedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (consumedToken.count !== 1) {
        throw new Error("Student update token was already consumed.");
      }

      if (existingUser) {
        await tx.user.update({
          where: {
            id: existingUser.id,
          },
          data: {
            passwordHash,
            emailVerified: true,
          },
        });
      } else {
        await tx.user.create({
          data: {
            email,
            passwordHash,
            role: UserRole.student,
            emailVerified: true,
          },
        });
      }
    });

    return {
      success: true,
      message: "Your portal password has been set.",
    };
  } catch (error) {
    console.error("Failed to set student portal password:", error);

    return {
      success: false,
      message: "We could not set your password right now.",
    };
  }
}
