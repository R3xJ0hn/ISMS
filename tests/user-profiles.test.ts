import assert from "node:assert/strict";
import test from "node:test";
import { getProfileForUser, getProfilesForUsers, getUserForProfile, ProfileIdentityError, type UserIdentity } from "../lib/users/profiles";
import type { EmployeeRole } from "../lib/generated/prisma/enums";

type Person = { id: bigint; firstName: string | null; middleName: string | null; lastName: string | null; suffix: string | null; userImage: string | null };
type Employee = Person & { emailAddress: string; role: EmployeeRole; teacher: { userId: bigint } | null };
type Student = Person & { email: string };
const person = { id: 9007199254740993n, firstName: "Maria", middleName: "Reyes", lastName: "Santos", suffix: "N/A", userImage: "https://saved.example/photo.png" };
const user = (changes: Partial<UserIdentity> = {}): UserIdentity => ({ id: 77n, email: "maria@example.test", role: "teacher", userImage: null, ...changes });
const employee = (changes: Partial<Employee> = {}): Employee => ({ ...person, emailAddress: "maria@example.test", role: "teacher", teacher: null, ...changes });
const student = (changes: Partial<Student> = {}): Student => ({ ...person, email: "maria@example.test", ...changes });

function harness({ users = [user()], employees = [], students = [] }: { users?: UserIdentity[]; employees?: Employee[]; students?: Student[] } = {}) {
  const reads: Array<{ table: string; query: unknown }> = [];
  function delegate<T extends { id: bigint }>(table: string, rows: T[]) {
    return {
      findMany: async (query: unknown) => { reads.push({ table, query }); return structuredClone(rows); },
      findUnique: async (query: { where: { id: bigint } }) => { reads.push({ table, query }); return structuredClone(rows.find((row) => row.id === query.where.id) ?? null); },
    };
  }
  const db = { user: delegate("user", users), employee: delegate("employee", employees), student: delegate("student", students) } as unknown as Parameters<typeof getProfilesForUsers>[0];
  return { db, reads };
}

test("Manage Users batches saved names and photos by portal role without mixing student and employee identities", async () => {
  const teacher = user(), learner = user({ id: 88n, role: "student" }), admin = user({ id: 99n, role: "admin", email: "office@example.test" });
  const h = harness({ users: [teacher, learner, admin], employees: [employee(), employee({ id: 2n, role: "admin", emailAddress: admin.email, firstName: "Office" })], students: [student({ firstName: "Student" })] });
  const result = await getProfilesForUsers(h.db, [teacher, learner, admin]);
  assert.equal(result.get(teacher.id)?.name, "Maria Reyes Santos");
  assert.equal(result.get(learner.id)?.name, "Student Reyes Santos");
  assert.equal(result.get(admin.id)?.name, "Office Reyes Santos");
  assert.equal(result.get(teacher.id)?.userImage, person.userImage);
  assert.equal(h.reads.length, 3, "Names are loaded in batches instead of per row");
});

test("teacher FK remains authoritative when employee email, role or status has changed", async () => {
  const account = user(), h = harness({ users: [account], employees: [employee({ teacher: { userId: account.id }, emailAddress: "different@example.test", role: "nonTeaching" })] });
  assert.equal((await getProfileForUser(h.db, account))?.id, person.id);
  assert.equal((await getUserForProfile(h.db, { kind: "employee", id: person.id }))?.id, account.id);
});

test("unmatched, duplicate and conflicting associations never guess a name or write target", async () => {
  const account = user();
  for (const employees of [[employee(), employee({ id: 2n })], [employee({ teacher: { userId: 999n } })]]) {
    const h = harness({ employees });
    assert.equal((await getProfilesForUsers(h.db, [account])).size, 0);
    await assert.rejects(getProfileForUser(h.db, account), ProfileIdentityError);
  }
  const duplicateUsers = harness({ users: [account, user({ id: 78n, email: "MARIA@example.test" })], employees: [employee()] });
  await assert.rejects(getUserForProfile(duplicateUsers.db, { kind: "employee", id: person.id }), ProfileIdentityError);
  const noMatch = harness({ employees: [employee({ role: "nonTeaching" })] });
  assert.equal(await getProfileForUser(noMatch.db, account), null);
  assert.equal(await getUserForProfile(noMatch.db, { kind: "employee", id: person.id }), null);
});

test("hidden accounts are never resolved and student profiles cannot attach to employee or protected roles", async () => {
  const hidden = user({ role: "superAdmin" }), h = harness({ users: [hidden], employees: [employee()], students: [student()] });
  assert.equal((await getProfilesForUsers(h.db, [hidden])).size, 0); assert.equal(h.reads.length, 0);
  assert.equal(await getUserForProfile(h.db, { kind: "student", id: person.id }), null);
  const badLink = harness({ users: [hidden], employees: [employee({ teacher: { userId: hidden.id } })] });
  await assert.rejects(getUserForProfile(badLink.db, { kind: "employee", id: person.id }), ProfileIdentityError);
});

test("name matching escapes SQL wildcard characters, preserves exact BigInt IDs and treats absent names as unlinked", async () => {
  const account = user({ role: "student", email: "name_%\\@example.test" });
  const h = harness({ users: [account], students: [student({ email: account.email, firstName: null, middleName: null, lastName: null, suffix: "n/a" })] });
  const result = await getProfilesForUsers(h.db, [account]);
  assert.equal(result.get(account.id)?.id, person.id); assert.equal(result.get(account.id)?.name, null);
  const serialized = JSON.stringify(h.reads, (_key, value) => typeof value === "bigint" ? value.toString() : value);
  assert.ok(serialized.includes("name\\\\_\\\\%\\\\\\\\@example.test"), serialized);
});
