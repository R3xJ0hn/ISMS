import { hashPassword } from "@/lib/auth/credentials";
import { Prisma } from "@/lib/generated/prisma/client";
import { EmployeeRole, EmployeeStatus, UserRole, VerificationTokenPurpose } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { getEmployeeFullName } from "@/lib/employees/names";
import { verifyTeacherInvitationToken, type TeacherInvitationClaims } from "@/lib/auth/tokens";
import { teacherEmployeeSelect, teacherInvitationSelect, type TeacherEmployeeRecord } from "./records";
import { parseTeacherActivationForm, type TeacherFormState } from "./validation";

const invalid: TeacherFormState = { success: false, message: "This account setup link is invalid, expired, already used, or no longer available. Ask your administrator to resend the setup email.", fieldErrors: { token: "Use a current teacher account setup link." } };
type Invitation = Prisma.VerificationTokenGetPayload<{ select: typeof teacherInvitationSelect }>;
function usable(invitation: Invitation | null, claims: TeacherInvitationClaims, now: Date) {
  return invitation !== null && invitation.purpose === VerificationTokenPurpose.teacherSetup && invitation.userId === null &&
    invitation.employeeId !== null && invitation.employeeId.toString() === claims.employeeRecordId && invitation.consumedAt === null &&
    invitation.expiresAt > now && invitation.expiresAt.getTime() === claims.expiresAt.getTime();
}
function eligible(employee: TeacherEmployeeRecord | null, claims: TeacherInvitationClaims): employee is TeacherEmployeeRecord {
  return employee !== null && employee.role === EmployeeRole.teacher && employee.status !== EmployeeStatus.Resigned && !employee.teacher && normalizeEmail(employee.emailAddress) === claims.email;
}

export async function getTeacherActivationRecord(token: string) {
  const claims = await verifyTeacherInvitationToken(token);
  if (!claims) return null;
  try {
    const invitation = await prisma.verificationToken.findUnique({ where: {
      jti: claims.jti, employeeId: BigInt(claims.employeeRecordId), userId: null, purpose: VerificationTokenPurpose.teacherSetup,
    }, select: teacherInvitationSelect });
    if (!usable(invitation, claims, new Date())) return null;
    const employee = await prisma.employee.findFirst({ where: { id: BigInt(claims.employeeRecordId), role: EmployeeRole.teacher }, select: teacherEmployeeSelect });
    if (!eligible(employee, claims) || await prisma.user.findFirst({ where: { email: literalInsensitiveEquality(claims.email) }, select: { id: true } })) return null;
    return { employeeRecordId: employee.id.toString(), fullName: getEmployeeFullName(employee), emailAddress: claims.email };
  } catch { return null; }
}

export async function activateTeacher(_previousState: TeacherFormState, formData: FormData): Promise<TeacherFormState> {
  const parsed = parseTeacherActivationForm(formData);
  if (!parsed.success) return parsed;
  const claims = await verifyTeacherInvitationToken(parsed.token);
  if (!claims) return invalid;
  let result: TeacherFormState;
  try {
    result = await prisma.$transaction(async (tx): Promise<TeacherFormState> => {
      const now = new Date();
      const invitation = await tx.verificationToken.findUnique({ where: {
        jti: claims.jti, employeeId: BigInt(claims.employeeRecordId), userId: null, purpose: VerificationTokenPurpose.teacherSetup,
      }, select: teacherInvitationSelect });
      if (!usable(invitation, claims, now)) return invalid;
      const employeeId = BigInt(claims.employeeRecordId);
      // Lock the profile before checking it, so concurrent email/role edits cannot invalidate account creation mid-transaction.
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT "id" FROM "employees" WHERE "id" = ${employeeId} FOR UPDATE`);
      if (locked.length !== 1) return invalid;
      const employee = await tx.employee.findFirst({ where: { id: employeeId, role: EmployeeRole.teacher }, select: teacherEmployeeSelect });
      if (!eligible(employee, claims) || await tx.user.findFirst({ where: { email: literalInsensitiveEquality(claims.email) }, select: { id: true } })) return invalid;
      const passwordHash = await hashPassword(parsed.password);
      const consumed = await tx.verificationToken.updateMany({ where: {
        jti: claims.jti, employeeId, userId: null, purpose: VerificationTokenPurpose.teacherSetup,
        consumedAt: null, expiresAt: { gt: new Date(), equals: claims.expiresAt },
      }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) return invalid;
      const user = await tx.user.create({ data: { email: claims.email, role: UserRole.teacher, emailVerified: true, passwordHash }, select: { id: true } });
      await tx.teacher.create({ data: { employeeId, userId: user.id } });
      return { success: true, message: "Your teacher account is activated. Sign in with your email and chosen password." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    return { success: false, message: "We could not create your teacher account. Try again or ask your administrator to resend the account setup email." };
  }
  // Teacher management reads current database data on each load. Revalidating
  // here would rerender this setup page after consumption and hide its success form.
  return result;
}
