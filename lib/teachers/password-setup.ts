import { Prisma } from "@/lib/generated/prisma/client";
import { EmployeeRole, EmployeeStatus, VerificationTokenPurpose } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { sendPasswordResetEmail } from "@/lib/auth/email";
import { createPasswordResetUrl, createTeacherInvitationToken, PASSWORD_RESET_TTL_SECONDS, validTeacherInvitationEmail } from "@/lib/auth/tokens";

const employeeSelect = {
  id: true, emailAddress: true, role: true, status: true,
  teacher: { select: { userId: true } },
} as const satisfies Prisma.EmployeeSelect;

type SetupRequest = { employeeId: bigint; jti: string; email: string; resetUrl: string } | null;

// Called by the rate-limited Forgot password flow after its generic response.
// Account creation remains in activation, after the emailed token is redeemed.
export async function requestTeacherPasswordSetup(email: string): Promise<void> {
  email = normalizeEmail(email);
  if (!validTeacherInvitationEmail(email)) return;
  let request: SetupRequest;
  try {
    request = await prisma.$transaction(async (tx): Promise<SetupRequest> => {
      const where = { emailAddress: literalInsensitiveEquality(email) };
      const candidates = await tx.employee.findMany({ where, select: { id: true }, take: 2 });
      if (candidates.length !== 1) return null;
      const employeeId = candidates[0].id;
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT "id" FROM "employees" WHERE "id" = ${employeeId} FOR UPDATE`);
      if (locked.length !== 1) return null;
      const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: employeeSelect });
      if (!employee || employee.role !== EmployeeRole.teacher || employee.status === EmployeeStatus.Resigned ||
        employee.teacher || normalizeEmail(employee.emailAddress) !== email) return null;
      // Refuse ambiguous employee records, including records with another role.
      const current = await tx.employee.findMany({ where, select: { id: true }, take: 2 });
      if (current.length !== 1 || current[0].id !== employeeId ||
        await tx.user.findFirst({ where: { email: literalInsensitiveEquality(email) }, select: { id: true } })) return null;
      const now = new Date();
      const recent = await tx.verificationToken.findFirst({ where: {
        employeeId, userId: null, purpose: VerificationTokenPurpose.teacherSetup,
        createdAt: { gt: new Date(now.getTime() - 60_000) },
      }, select: { id: true } });
      if (recent) return null;
      const issued = await createTeacherInvitationToken(employeeId.toString(), email, { ttlSeconds: PASSWORD_RESET_TTL_SECONDS });
      const resetUrl = createPasswordResetUrl(issued.token);
      await tx.verificationToken.updateMany({ where: {
        employeeId, userId: null, purpose: VerificationTokenPurpose.teacherSetup, consumedAt: null,
      }, data: { consumedAt: now } });
      await tx.verificationToken.create({ data: {
        jti: issued.jti, employeeId, userId: null, purpose: VerificationTokenPurpose.teacherSetup, expiresAt: issued.expiresAt,
      } });
      return { employeeId, jti: issued.jti, email, resetUrl };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { return; }
  if (!request) return;
  try { await sendPasswordResetEmail({ to: request.email, resetUrl: request.resetUrl }); }
  catch {
    try {
      await prisma.verificationToken.deleteMany({ where: {
        jti: request.jti, employeeId: request.employeeId, userId: null,
        purpose: VerificationTokenPurpose.teacherSetup, consumedAt: null,
      } });
    } catch { /* Cleanup affects only this request's unused token. */ }
  }
}
