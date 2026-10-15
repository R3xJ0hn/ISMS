import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { EmployeeRole, EmployeeStatus, VerificationTokenPurpose } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { getEmployeeFullName } from "@/lib/employees/names";
import { revalidatePath } from "next/cache";
import { sendTeacherInvitationEmail } from "@/lib/auth/email";
import { createTeacherInvitationToken, createTeacherInvitationUrl, validTeacherInvitationEmail } from "@/lib/auth/tokens";
import { serializeTeacherEmployee, teacherEmployeeSelect } from "./records";
import { parseTeacherEmployeeId, parseTeacherInvitationForm, type TeacherFormState } from "./validation";

export type { TeacherEmployeeRow } from "./records";
const failure: TeacherFormState = { success: false, message: "Unable to send the teacher account setup email. Please try again." };
const unavailable: TeacherFormState = { success: false, message: "Choose an eligible teacher employee with an unused account email.", fieldErrors: { employeeRecordId: "This employee is not eligible for account setup." } };

function visibleTeacherEmployeeWhere(superAdminEmail: string) {
  return {
    role: EmployeeRole.teacher,
    NOT: [
      { emailAddress: literalInsensitiveEquality(normalizeEmail(superAdminEmail)) },
      { teacher: { is: { user: { role: "superAdmin" as const } } } },
    ],
  };
}

export async function getTeacherEmployees() {
  const superAdmin = await requireSuperAdmin();
  const employees = await prisma.employee.findMany({ where: visibleTeacherEmployeeWhere(superAdmin.email), select: teacherEmployeeSelect, orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }] });
  const emails = [...new Set(employees.filter((employee) => !employee.teacher).map((employee) => normalizeEmail(employee.emailAddress)))];
  const users = emails.length ? await prisma.user.findMany({ where: { OR: emails.map((email) => ({ email: literalInsensitiveEquality(email) })) }, select: { email: true } }) : [];
  const conflicts = new Set(users.map((user) => normalizeEmail(user.email)));
  return employees.map((employee) => serializeTeacherEmployee(employee, conflicts.has(normalizeEmail(employee.emailAddress))));
}

export async function getTeacherEmployeeForInvitation(employeeRecordId: string) {
  const superAdmin = await requireSuperAdmin();
  const id = parseTeacherEmployeeId(employeeRecordId);
  if (id === null) return null;
  const employee = await prisma.employee.findFirst({ where: { id, ...visibleTeacherEmployeeWhere(superAdmin.email) }, select: teacherEmployeeSelect });
  if (!employee) return null;
  const conflict = !employee.teacher && await prisma.user.findFirst({ where: { email: literalInsensitiveEquality(normalizeEmail(employee.emailAddress)) }, select: { id: true } });
  return serializeTeacherEmployee(employee, Boolean(conflict));
}

type Request = { kind: "state"; state: TeacherFormState } | { kind: "send"; employeeId: bigint; jti: string; to: string; fullName: string; invitationUrl: string };

export async function inviteTeacher(_previousState: TeacherFormState, formData: FormData): Promise<TeacherFormState> {
  const superAdmin = await requireSuperAdmin();
  const parsed = parseTeacherInvitationForm(formData);
  if (!parsed.success) return parsed;
  let request: Request;
  try {
    request = await prisma.$transaction(async (tx): Promise<Request> => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>(Prisma.sql`SELECT "id" FROM "employees" WHERE "id" = ${parsed.employeeId} FOR UPDATE`);
      if (locked.length !== 1) return { kind: "state", state: unavailable };
      const employee = await tx.employee.findFirst({ where: { id: parsed.employeeId, ...visibleTeacherEmployeeWhere(superAdmin.email) }, select: teacherEmployeeSelect });
      if (!employee || employee.status === EmployeeStatus.Resigned || employee.teacher) return { kind: "state", state: unavailable };
      const email = normalizeEmail(employee.emailAddress);
      if (!validTeacherInvitationEmail(email) || await tx.user.findFirst({ where: { email: literalInsensitiveEquality(email) }, select: { id: true } })) {
        return { kind: "state", state: unavailable };
      }
      const now = new Date();
      const recent = await tx.verificationToken.findFirst({ where: { employeeId: employee.id, userId: null, purpose: VerificationTokenPurpose.teacherSetup, createdAt: { gt: new Date(now.getTime() - 60_000) } }, select: { id: true } });
      if (recent) return { kind: "state", state: { success: false, message: "Please wait 60 seconds before sending another account setup email." } };
      const issued = await createTeacherInvitationToken(employee.id.toString(), email);
      const invitationUrl = createTeacherInvitationUrl(issued.token);
      await tx.verificationToken.updateMany({ where: { employeeId: employee.id, userId: null, purpose: VerificationTokenPurpose.teacherSetup, consumedAt: null }, data: { consumedAt: now } });
      await tx.verificationToken.create({ data: { jti: issued.jti, employeeId: employee.id, userId: null, purpose: VerificationTokenPurpose.teacherSetup, expiresAt: issued.expiresAt } });
      return { kind: "send", employeeId: employee.id, jti: issued.jti, to: email, fullName: getEmployeeFullName(employee), invitationUrl };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch { return failure; }
  if (request.kind === "state") return request.state;
  revalidatePath("/portal/teachers");
  try {
    await sendTeacherInvitationEmail({ to: request.to, fullName: request.fullName, invitationUrl: request.invitationUrl });
  } catch {
    try { await prisma.verificationToken.deleteMany({ where: { jti: request.jti, employeeId: request.employeeId, userId: null, purpose: VerificationTokenPurpose.teacherSetup, consumedAt: null } }); } catch { /* Delivery cleanup affects only this pending invitation. */ }
    revalidatePath("/portal/teachers");
    return failure;
  }
  return { success: true, message: "Account setup email sent. The teacher can verify their email and choose a password. The link expires in 1 hour." };
}
