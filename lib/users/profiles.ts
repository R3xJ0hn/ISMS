import type { Prisma } from "@/lib/generated/prisma/client";
import type { UserRole } from "@/lib/generated/prisma/enums";
import { literalInsensitiveEquality, normalizeEmail, nullableInputText } from "@/lib/utils";

type ProfileClient = Pick<Prisma.TransactionClient, "user" | "employee" | "student">;
export type UserIdentity = { id: bigint; email: string; role: UserRole; userImage: string | null };
export type Profile = { kind: "employee" | "student"; id: bigint; name: string | null; userImage: string | null };
export type ProfileReference = Pick<Profile, "kind" | "id">;

/** Identity conflicts must never attach a photo or a name to a guessed account. */
export class ProfileIdentityError extends Error {
  constructor() { super("The linked account is ambiguous or changed. Reload the page and check the saved email and account role."); }
}

const identitySelect = { id: true, email: true, role: true, userImage: true } as const;
const profileSelect = { id: true, firstName: true, middleName: true, lastName: true, suffix: true, userImage: true } as const;
const employeeSelect = { ...profileSelect, emailAddress: true, role: true, teacher: { select: { userId: true } } } as const;
const studentSelect = { ...profileSelect, email: true } as const;
type EmployeeProfile = Prisma.EmployeeGetPayload<{ select: typeof employeeSelect }>;
type StudentProfile = Prisma.StudentGetPayload<{ select: typeof studentSelect }>;

function asProfile(kind: Profile["kind"], record: EmployeeProfile | StudentProfile): Profile {
  const name = [record.firstName, record.middleName, record.lastName, record.suffix]
    .map(nullableInputText).filter(Boolean).join(" ") || null;
  return { kind, id: record.id, name, userImage: record.userImage };
}

function emailMatches(left: string, right: string) {
  return normalizeEmail(left) === normalizeEmail(right);
}

function uniqueAccount(users: UserIdentity[], role: UserRole, email: string) {
  const matches = users.filter((user) => user.role === role && emailMatches(user.email, email));
  if (matches.length > 1) throw new ProfileIdentityError();
  return matches[0] ?? null;
}

async function loadProfiles(tx: ProfileClient, users: UserIdentity[]) {
  const visibleUsers = users.filter((user) => user.role !== "superAdmin");
  const studentEmails = visibleUsers.filter((user) => user.role === "student").map((user) => normalizeEmail(user.email));
  const staff = visibleUsers.filter((user) => ["admin", "registrar", "teacher"].includes(user.role));
  const teacherIds = staff.filter((user) => user.role === "teacher").map((user) => user.id);
  const [accounts, employees, students] = await Promise.all([
    visibleUsers.length ? tx.user.findMany({ where: { OR: visibleUsers.map((user) => ({
      role: user.role, email: literalInsensitiveEquality(normalizeEmail(user.email)),
    })) }, select: identitySelect }) : [],
    staff.length ? tx.employee.findMany({ where: { OR: [
      ...staff.map((user) => ({ emailAddress: literalInsensitiveEquality(normalizeEmail(user.email)) })),
      ...(teacherIds.length ? [{ teacher: { userId: { in: teacherIds } } }] : []),
    ] }, select: employeeSelect }) : [],
    studentEmails.length ? tx.student.findMany({ where: { OR: studentEmails.map((email) => ({
      email: literalInsensitiveEquality(email),
    })) }, select: studentSelect }) : [],
  ]);
  return { accounts, employees, students };
}

function resolveProfile(user: UserIdentity, data: Awaited<ReturnType<typeof loadProfiles>>): Profile | null {
  if (user.role === "superAdmin") return null;
  if (user.role === "teacher") {
    const linked = data.employees.filter((employee) => employee.teacher?.userId === user.id);
    if (linked.length > 1) throw new ProfileIdentityError();
    // The existing FK remains authoritative when an employee's email, role, or status changes.
    if (linked[0]) return asProfile("employee", linked[0]);
  }
  if (user.role === "student") {
    const matches = data.students.filter((student) => emailMatches(student.email, user.email));
    if (matches.length > 1) throw new ProfileIdentityError();
    if (!matches[0]) return null;
    if (uniqueAccount(data.accounts, user.role, user.email)?.id !== user.id) throw new ProfileIdentityError();
    return asProfile("student", matches[0]);
  }
  const matches = data.employees.filter((employee) => employee.role === user.role && emailMatches(employee.emailAddress, user.email));
  if (matches.length > 1) throw new ProfileIdentityError();
  if (!matches[0]) return null;
  if (matches[0].teacher || uniqueAccount(data.accounts, user.role, user.email)?.id !== user.id) throw new ProfileIdentityError();
  return asProfile("employee", matches[0]);
}

/** Batched list lookup: ambiguous identities are deliberately displayed as unlinked. */
export async function getProfilesForUsers(tx: ProfileClient, users: UserIdentity[]): Promise<Map<bigint, Profile>> {
  const data = await loadProfiles(tx, users);
  const profiles = new Map<bigint, Profile>();
  for (const user of users) {
    try {
      const profile = resolveProfile(user, data);
      if (profile) profiles.set(user.id, profile);
    } catch (error) { if (!(error instanceof ProfileIdentityError)) throw error; }
  }
  return profiles;
}

/** Strict write lookup; a conflicting match must abort the surrounding transaction. */
export async function getProfileForUser(tx: ProfileClient, user: UserIdentity): Promise<Profile | null> {
  return resolveProfile(user, await loadProfiles(tx, [user]));
}

/** Profiles may exist without accounts. This lookup never creates or grants an account. */
export async function getUserForProfile(tx: ProfileClient, reference: ProfileReference): Promise<UserIdentity | null> {
  if (reference.kind === "employee") {
    const employee = await tx.employee.findUnique({ where: { id: reference.id }, select: employeeSelect });
    if (!employee) return null;
    if (employee.teacher) {
      const linked = await tx.user.findUnique({ where: { id: employee.teacher.userId }, select: identitySelect });
      if (!linked || linked.role !== "teacher") throw new ProfileIdentityError();
      return linked;
    }
    if (employee.role === "nonTeaching") return null;
    const accounts = await tx.user.findMany({ where: {
      role: employee.role, email: literalInsensitiveEquality(normalizeEmail(employee.emailAddress)),
    }, select: identitySelect });
    const user = uniqueAccount(accounts, employee.role, employee.emailAddress);
    if (!user) return null;
    const profile = await getProfileForUser(tx, user);
    if (profile?.kind !== "employee" || profile.id !== reference.id) throw new ProfileIdentityError();
    return user;
  }
  const student = await tx.student.findUnique({ where: { id: reference.id }, select: studentSelect });
  if (!student) return null;
  const accounts = await tx.user.findMany({ where: {
    role: "student", email: literalInsensitiveEquality(normalizeEmail(student.email)),
  }, select: identitySelect });
  const user = uniqueAccount(accounts, "student", student.email);
  if (!user) return null;
  const profile = await getProfileForUser(tx, user);
  if (profile?.kind !== "student" || profile.id !== reference.id) throw new ProfileIdentityError();
  return user;
}
