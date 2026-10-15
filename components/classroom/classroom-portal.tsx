import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { formatStudentName, getEmailDisplayName, normalizeEmail, parseId } from "@/lib/utils";
import { getEmployeeFullName } from "@/lib/employees/names";
import { ClassroomShell } from "./classroom-shell";

export async function ClassroomPortal({ session, children }: {
  session: { id: string; email: string; role: "teacher" | "student" };
  children: ReactNode;
}) {
  const userId = parseId(session.id);
  const validId = userId !== null && userId > 0n && userId <= 9223372036854775807n;
  const nameSelection = { firstName: true, middleName: true, lastName: true, suffix: true } as const;
  const email = normalizeEmail(session.email);
  const [user, teacher, students] = await Promise.all([
    validId ? prisma.user.findUnique({ where: { id: userId }, select: { userImage: true } }) : null,
    validId && session.role === "teacher" ? prisma.teacher.findUnique({ where: { userId }, select: { employee: { select: nameSelection } } }) : null,
    session.role === "student" ? prisma.student.findMany({ where: { email: { equals: email.replace(/[\\%_]/g, (character) => `\\${character}`), mode: "insensitive" } }, select: nameSelection, take: 2 }) : [],
  ]);
  const profileName = teacher ? getEmployeeFullName(teacher.employee) : students.length === 1 ? formatStudentName(students[0]) : null;
  const displayName = profileName && profileName !== "Name not set" ? profileName : getEmailDisplayName(email, session.role === "teacher" ? "Teacher" : "Student");
  return <ClassroomShell role={session.role} displayName={displayName} email={session.email} avatarUrl={user?.userImage ?? null}>{children}</ClassroomShell>;
}
