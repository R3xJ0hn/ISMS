import { hash } from "bcryptjs";

import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { verifyStudentUpdateToken } from "./student-update";
import { encrypt } from "../encryption";

const PASSWORD_HASH_ROUNDS = 12;

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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function formatStudentDisplayName(student: {
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

export async function getStudentUpdatePasswordRecord(token: string) {
  const payload = verifyStudentUpdateToken(token);

  if (!payload) {
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
    displayName: formatStudentDisplayName(student),
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
    const passKey = encrypt(password);

    if (existingUser) {
      await prisma.user.update({
        where: {
          id: existingUser.id,
        },
        data: {
          passwordHash,
          key: passKey,
          emailVerified: true,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          key: passKey,
          role: UserRole.student,
          emailVerified: true,
        },
      });
    }

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
