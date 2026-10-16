import assert from "node:assert/strict";
import test from "node:test";
import { UserRole } from "../lib/generated/prisma/enums";
import { createTeacherInvitationToken } from "../lib/auth/tokens";
import {
  account, form, passwordForm, seedReset, serviceHarness, setupEnvironment, state,
} from "./password-reset-harness";
import {
  account as teacherAccount, employee, serviceHarness as teacherHarness, type Invitation,
} from "./teacher-services-harness";

async function setupToken() {
  const selected = employee();
  const issued = await createTeacherInvitationToken(selected.id.toString(), selected.emailAddress, { ttlSeconds: 1800 });
  const record: Invitation = {
    id: 1n, jti: issued.jti, purpose: "teacherSetup", userId: null, employeeId: selected.id,
    expiresAt: issued.expiresAt, createdAt: new Date(), consumedAt: null,
  };
  return { selected, issued, record };
}

test("missing accounts request teacher setup only after the generic response and completed lookup", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness({ users: [] });
  const result = await subject.service.requestPasswordReset(state, form({
    email: " MARIA@Example.TEST ", role: "superAdmin", employeeRecordId: "999",
  }));
  assert.equal(result.success, true);
  assert.match(result.message, /set or reset your password/);
  assert.deepEqual(subject.setupRequests, []);
  assert.equal(subject.calls.length, 0);
  assert.equal(subject.database.tokens.length, 0);
  assert.equal(subject.database.users.length, 0);
  await subject.runAfter();
  assert.deepEqual(subject.setupRequests, ["maria@example.test"]);
  assert.ok(subject.events.indexOf("commit") < subject.events.indexOf("teacher.setup-request"));
  assert.equal(subject.emails.length, 0);
  assert.equal(subject.database.users.length, 0);
});

test("existing, ambiguous, cooldown, rate-limited and failed account requests never fall through to teacher setup", async (t) => {
  setupEnvironment(t);
  for (const options of [
    {}, { users: [account(), account({ id: 2n, email: "PERSON@EXAMPLE.TEST" })] },
    { allowed: false }, { rateFailure: true }, { createFailure: true }, { lockFailure: true }, { lockMiss: true },
    { users: [account({ sessionVersion: 2147483647 })] },
  ]) {
    const subject = serviceHarness(options);
    await subject.service.requestPasswordReset(state, form({ email: account().email }));
    await subject.runAfter();
    assert.deepEqual(subject.setupRequests, []);
  }
  const cooldown = serviceHarness();
  await seedReset(cooldown);
  cooldown.database.tokens[0].createdAt = new Date();
  await cooldown.service.requestPasswordReset(state, form({ email: account().email }));
  await cooldown.runAfter();
  assert.deepEqual(cooldown.setupRequests, []);
  assert.equal(cooldown.emails.length, 0);
});

test("failed first-password requests stay private and create no account", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness({ users: [], setupRequest: async () => { throw new Error("Private employee and provider details"); } });
  assert.equal((await subject.service.requestPasswordReset(state, form({ email: employee().emailAddress }))).success, true);
  await subject.runAfter();
  assert.deepEqual(subject.setupRequests, [employee().emailAddress]);
  assert.deepEqual(subject.database, { users: [], tokens: [] });
  assert.deepEqual(subject.logs, []);
});

test("first-password links preview their proven email and create a verified linked teacher only on submission", async (t) => {
  setupEnvironment(t);
  const { selected, issued, record } = await setupToken();
  const teachers = teacherHarness({ tokens: [record] });
  const subject = serviceHarness({ users: [], teacherActivation: teachers.activation });
  assert.deepEqual(await subject.service.getPasswordResetRecord(issued.token), { email: selected.emailAddress, accountSetup: true });
  assert.equal(teachers.database.users.length, 0);
  assert.equal(teachers.database.teachers.length, 0);
  assert.equal(teachers.database.tokens[0].consumedAt, null);
  assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token, {
    employeeRecordId: "999", userId: "888", email: "attacker@example.test", role: "superAdmin",
  }))).success, true);
  assert.equal(teachers.database.users.length, 1);
  assert.equal(teachers.database.users[0].email, selected.emailAddress);
  assert.equal(teachers.database.users[0].role, "teacher");
  assert.equal(teachers.database.users[0].emailVerified, true);
  assert.deepEqual(teachers.database.teachers, [{ employeeId: selected.id, userId: teachers.database.users[0].id }]);
  assert.deepEqual(teachers.passwords, [" <Strong123!> "]);
  assert.ok(teachers.database.tokens[0].consumedAt);
  assert.equal(subject.passwords.length, 0, "The ordinary reset path cannot write the first teacher password.");
  assert.equal(subject.calls.length, 0);
  assert.equal(subject.scheduled.length, 0);
  const after = structuredClone(teachers.database);
  assert.equal(await subject.service.getPasswordResetRecord(issued.token), null);
  assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token, {
    password: "Different123!", confirmPassword: "Different123!",
  }))).success, false);
  assert.deepEqual(teachers.database, after);
  assert.equal(teachers.passwords.length, 1);
});

test("teacher setup bridge rejects borrowed ledger purposes and malformed targets before profile or account reads", async (t) => {
  setupEnvironment(t);
  const { issued, record } = await setupToken();
  for (const override of [
    { purpose: "passwordReset" as const, employeeId: null, userId: 25n },
    { purpose: "emailVerification" as const, employeeId: null, userId: 25n },
    { purpose: "studentUpdate" as const, employeeId: null, userId: 25n },
    { userId: 25n }, { employeeId: null }, { employeeId: 2n },
    { consumedAt: new Date() }, { expiresAt: new Date(0) }, { expiresAt: new Date(+record.expiresAt + 1) },
  ]) {
    const teachers = teacherHarness({ tokens: [{ ...record, ...override }], unscopedTokenRead: true });
    const subject = serviceHarness({ users: [], teacherActivation: teachers.activation });
    const before = structuredClone(teachers.database);
    assert.equal(await subject.service.getPasswordResetRecord(issued.token), null);
    const result = await subject.service.resetPassword(state, passwordForm(issued.token));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.token);
    assert.match(result.message, /password reset link is invalid/);
    assert.deepEqual(teachers.database, before);
    assert.equal(teachers.passwords.length, 0);
    assert.equal(teachers.calls.some(({ method }) => method.startsWith("employee.") || method.startsWith("user.")), false);
  }
});

test("saved employee changes, resignation and existing accounts of any role invalidate first-password links", async (t) => {
  setupEnvironment(t);
  const { selected, issued, record } = await setupToken();
  const fixtures = [
    { employees: [] }, { employees: [{ ...selected, role: "nonTeaching" as const }] },
    { employees: [{ ...selected, role: "admin" as const }] }, { employees: [{ ...selected, status: "Resigned" as const }] },
    { employees: [{ ...selected, emailAddress: "changed@example.test" }] },
    ...Object.values(UserRole).map((role) => ({ users: [teacherAccount({ email: selected.emailAddress.toUpperCase(), role })] })),
    { users: [teacherAccount()], teachers: [{ employeeId: selected.id, userId: teacherAccount().id }] },
  ];
  for (const fixture of fixtures) {
    const teachers = teacherHarness({ ...fixture, tokens: [record] });
    const subject = serviceHarness({ users: [], teacherActivation: teachers.activation });
    const before = structuredClone(teachers.database);
    assert.equal(await subject.service.getPasswordResetRecord(issued.token), null);
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
    assert.deepEqual(teachers.database, before);
    assert.equal(teachers.passwords.length, 0);
  }
});

test("first-password validation and failed atomic creation keep the link and all records unchanged", async (t) => {
  setupEnvironment(t);
  const { issued, record } = await setupToken();
  const teachers = teacherHarness({ tokens: [record] });
  const subject = serviceHarness({ users: [], teacherActivation: teachers.activation });
  for (const fields of [
    { password: "weak", confirmPassword: "weak" }, { password: "StrongPass1!", confirmPassword: "Different123!" },
    { password: "Aa1!" + "a".repeat(69), confirmPassword: "Aa1!" + "a".repeat(69) },
  ]) {
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token, fields))).success, false);
  }
  assert.equal(teachers.calls.length, 0);
  assert.equal(teachers.passwords.length, 0);
  assert.equal(teachers.database.tokens[0].consumedAt, null);
  for (const options of [{ writeFailure: "user" as const }, { writeFailure: "teacher" as const }, { consumeMiss: true }, { lockMiss: true }]) {
    const failing = teacherHarness({ tokens: [record], ...options });
    const reset = serviceHarness({ users: [], teacherActivation: failing.activation });
    const before = structuredClone(failing.database);
    const result = await reset.service.resetPassword(state, passwordForm(issued.token));
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /Offline|Private|Maria|900719|Strong123/);
    assert.deepEqual(failing.database, before);
  }
});

test("ordinary reset signatures never retry failed ledger checks as teacher activation", async (t) => {
  setupEnvironment(t);
  const invoked: string[] = [];
  const subject = serviceHarness({ teacherActivation: {
    getTeacherActivationRecord: async () => { invoked.push("preview"); throw new Error("Unexpected teacher preview"); },
    activateTeacher: async () => { invoked.push("activation"); throw new Error("Unexpected teacher activation"); },
  } });
  const issued = await seedReset(subject, { purpose: "teacherSetup", userId: null, employeeId: employee().id });
  assert.equal(await subject.service.getPasswordResetRecord(issued.token), null);
  assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
  assert.deepEqual(invoked, []);
});

test("unsigned and wrong-purpose tokens cannot create teacher accounts through reset password", async (t) => {
  setupEnvironment(t);
  const teachers = teacherHarness();
  const subject = serviceHarness({ users: [], teacherActivation: teachers.activation });
  assert.equal(await subject.service.getPasswordResetRecord("forged.token.signature"), null);
  assert.equal((await subject.service.resetPassword(state, passwordForm("forged.token.signature"))).success, false);
  assert.equal(teachers.calls.length, 0);
  assert.equal(teachers.passwords.length, 0);
  assert.equal(teachers.database.users.length, 0);
});
