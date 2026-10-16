import type { Prisma } from "@/lib/generated/prisma/client";
import { VerificationTokenPurpose } from "@/lib/generated/prisma/enums";
import { normalizeEmail } from "@/lib/utils";
import { getEmployeeFullName } from "@/lib/employees/names";

export const teacherEmployeeSelect = {
  id: true, employeeId: true, firstName: true, middleName: true, lastName: true, suffix: true,
  emailAddress: true, contactNumber: true, status: true, role: true,
  userImage: true,
  teacher: { select: { userId: true, user: { select: { email: true, role: true, emailVerified: true } } } },
  verificationTokens: {
    where: { purpose: VerificationTokenPurpose.teacherSetup, userId: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1,
    select: { purpose: true, employeeId: true, userId: true, createdAt: true, expiresAt: true, consumedAt: true },
  },
} as const satisfies Prisma.EmployeeSelect;
export const teacherInvitationSelect = {
  purpose: true, employeeId: true, userId: true, expiresAt: true, consumedAt: true,
} as const satisfies Prisma.VerificationTokenSelect;
export type TeacherEmployeeRecord = Prisma.EmployeeGetPayload<{ select: typeof teacherEmployeeSelect }>;
export type TeacherAccountStatus = "Not Activated" | "Setup Email Sent" | "Setup Expired" | "Active" | "Account Conflict";

export function serializeTeacherEmployee(employee: TeacherEmployeeRecord, conflictingEmail = false, now = new Date()) {
  const invitation = employee.verificationTokens.find((token) => token.purpose === VerificationTokenPurpose.teacherSetup && token.userId === null && token.employeeId === employee.id);
  const user = employee.teacher?.user;
  let accountStatus: TeacherAccountStatus;
  if (user) accountStatus = user.role === "teacher" && user.emailVerified && normalizeEmail(user.email) === normalizeEmail(employee.emailAddress)
    ? "Active" : "Account Conflict";
  else if (conflictingEmail) accountStatus = "Account Conflict";
  else if (invitation && invitation.consumedAt === null) accountStatus = invitation.expiresAt > now ? "Setup Email Sent" : "Setup Expired";
  else accountStatus = "Not Activated";
  return {
    employeeRecordId: employee.id.toString(), employeeId: employee.employeeId, fullName: getEmployeeFullName(employee),
    emailAddress: employee.emailAddress, contactNumber: employee.contactNumber, status: employee.status, accountStatus,
    invitationCreatedAt: invitation?.createdAt.toISOString() ?? null,
  };
}
export type TeacherEmployeeRow = ReturnType<typeof serializeTeacherEmployee>;
