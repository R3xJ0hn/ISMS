import { requireSession } from "@/lib/auth";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { redirect } from "next/navigation";

const studentIdentitySelection = {
  id: true, firstName: true, middleName: true, lastName: true, suffix: true, studentNumber: true,
} as const;

/** Resolve one literal email; case-only legacy duplicates never identify an arbitrary student. */
export async function findStudentByEmail<const Selection extends Prisma.StudentSelect>(
  emailAddress: string,
  select: Selection,
) {
  const email = normalizeEmail(emailAddress);
  if (!email) return null;
  const students = await prisma.student.findMany({
    where: { email: literalInsensitiveEquality(email) }, select, take: 2,
  });
  return students.length === 1 ? students[0] : null;
}

/** Uses the verified session only; route parameters cannot choose another student's identity. */
export async function getCurrentStudent() {
  const session = await requireSession();
  if (session.role !== "student") redirect("/portal");
  return findStudentByEmail(session.email, studentIdentitySelection);
}

export function studentClassMembershipWhere(studentId: bigint) {
  return {
    students: { some: { studentId } },
    teacher: { user: { role: "teacher" as const, emailVerified: true } },
  };
}
