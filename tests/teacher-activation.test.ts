import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { createTeacherInvitationToken } from "../lib/auth/tokens";
import { UserRole } from "../lib/generated/prisma/enums";
import { getEmployeeFullName } from "../lib/employees/names";
import { account, employee, form, initialState, serviceHarness, setupEnvironment, testSecret, userVerificationTokens, type Invitation } from "./teacher-services-harness";

async function setupRecord() {
  const selected = employee();
  const issued = await createTeacherInvitationToken(selected.id.toString(), selected.emailAddress);
  const invitation: Invitation = { id: 1n, jti: issued.jti, purpose: "teacherSetup", userId: null, employeeId: selected.id, expiresAt: issued.expiresAt, createdAt: new Date(), consumedAt: null };
  return { selected, issued, invitation };
}
const credentials = { password: " <Teacher123!> ", confirmPassword: " <Teacher123!> " };

test("opening an account setup email previews only name/email and does not create or consume records", async (t) => {
  setupEnvironment(t);
  const { selected, issued, invitation } = await setupRecord();
  const harness = serviceHarness({ tokens: [invitation] });
  const preview = await harness.activation.getTeacherActivationRecord(issued.token);
  assert.deepEqual(JSON.parse(JSON.stringify(preview)), { employeeRecordId: selected.id.toString(), fullName: getEmployeeFullName(selected), emailAddress: selected.emailAddress });
  assert.deepEqual(harness.database.tokens, [invitation]);
  assert.equal(harness.database.users.length, 0);
  assert.equal(harness.database.teachers.length, 0);
  assert.equal(harness.calls.some((call) => call.method.endsWith("create") || call.method.endsWith("updateMany")), false);
});

test("password setup verifies the email and atomically creates the linked teacher user", async (t) => {
  setupEnvironment(t);
  const { selected, issued, invitation } = await setupRecord();
  const harness = serviceHarness({ tokens: [invitation] });
  const result = await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials, role: "superAdmin", email: "attacker@example.test", employeeRecordId: "999" }));
  assert.equal(result.success, true);
  assert.equal(harness.database.users.length, 1);
  const user = harness.database.users[0];
  assert.equal(user.email, selected.emailAddress);
  assert.equal(user.role, "teacher");
  assert.equal(user.emailVerified, true);
  assert.equal(user.passwordHash, "offline-hash:" + credentials.password);
  assert.deepEqual(harness.database.teachers, [{ employeeId: selected.id, userId: user.id }]);
  assert.ok(harness.database.tokens[0].consumedAt);
  assert.equal(harness.events.indexOf("employee.lock") < harness.events.indexOf("hash"), true);
  assert.equal(harness.events.indexOf("user.create") < harness.events.indexOf("teacher.create"), true);
  assert.deepEqual(harness.isolations, ["Serializable"]);
  assert.deepEqual(harness.passwords, [credentials.password]);
  assert.deepEqual(harness.revalidated, []);
});

test("teacher activation inherits the employee photo without accepting a caller-supplied photo URL", async (t) => {
  setupEnvironment(t);
  const { selected, issued, invitation } = await setupRecord();
  const savedPhoto = "https://res.cloudinary.com/test/image/upload/saved-teacher.png";
  const h = serviceHarness({ employees: [{ ...selected, userImage: savedPhoto }], tokens: [invitation] });
  assert.equal((await h.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials, userImage: "https://forged.example/photo.png" }))).success, true);
  assert.equal(h.calls.find((call) => call.method === "user.create")?.query.data?.userImage, savedPhoto);
});

test("used setup emails cannot preview, create another account or reset the chosen password", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  const harness = serviceHarness({ tokens: [invitation] });
  assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, true);
  const before = structuredClone(harness.database);
  assert.equal(await harness.activation.getTeacherActivationRecord(issued.token), null);
  const repeated = await harness.activation.activateTeacher(initialState, form({ token: issued.token, password: "Different123!", confirmPassword: "Different123!" }));
  assert.equal(repeated.success, false);
  assert.deepEqual(harness.database, before);
  assert.equal(harness.passwords.length, 1);
});

test("invalid setup tokens do not read or write the database or hash a password", async () => {
  const harness = serviceHarness();
  assert.equal(await harness.activation.getTeacherActivationRecord("invalid.token"), null);
  assert.equal((await harness.activation.activateTeacher(initialState, form({ token: "invalid.token", ...credentials }))).success, false);
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.passwords.length, 0);
});

test("missing, expired, consumed, mismatched employee and changed expiry ledger records are rejected", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  for (const tokens of [[], [{ ...invitation, expiresAt: new Date(Date.now() - 1000) }], [{ ...invitation, consumedAt: new Date() }], [{ ...invitation, employeeId: 2n }], [{ ...invitation, expiresAt: new Date(+invitation.expiresAt + 1) }]]) {
    const harness = serviceHarness({ tokens });
    assert.equal(await harness.activation.getTeacherActivationRecord(issued.token), null);
    assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
    assert.equal(harness.database.users.length, 0);
    assert.equal(harness.database.teachers.length, 0);
    assert.equal(harness.passwords.length, 0);
  }
});

test("valid teacher signatures cannot borrow verification ledger identifiers from another purpose", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  for (const purpose of ["passwordReset", "emailVerification", "studentUpdate"] as const) {
    for (const unscopedTokenRead of [false, true]) {
      const borrowed: Invitation = { ...invitation, purpose, userId: 25n, employeeId: null };
      const harness = serviceHarness({ tokens: [borrowed], unscopedTokenRead });
      const before = structuredClone(harness.database);
      assert.equal(await harness.activation.getTeacherActivationRecord(issued.token), null, purpose);
      assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false, purpose);
      assert.deepEqual(harness.database, before);
      assert.equal(harness.passwords.length, 0);
      assert.equal(harness.calls.some((call) => call.method.startsWith("employee.") || call.method.startsWith("user.")), false);
      for (const call of harness.calls) {
        assert.equal(call.query.where?.purpose, "teacherSetup");
        assert.equal(call.query.where?.userId, null);
        assert.equal(call.query.where?.employeeId, employee().id);
      }
    }
  }
});

test("teacherSetup rows with user targets or absent or mismatched employee targets cannot activate an account", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  for (const target of [{ userId: 25n }, { employeeId: null }, { employeeId: 2n }]) {
    for (const unscopedTokenRead of [false, true]) {
      const malformed: Invitation = { ...invitation, ...target };
      const harness = serviceHarness({ tokens: [malformed], unscopedTokenRead });
      assert.equal(await harness.activation.getTeacherActivationRecord(issued.token), null);
      assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
      assert.deepEqual(harness.database.tokens, [malformed]);
      assert.equal(harness.database.users.length, 0);
      assert.equal(harness.database.teachers.length, 0);
      assert.equal(harness.passwords.length, 0);
    }
  }
});

test("existing teacher setup signatures remain usable with the migrated ledger and consume only their teacherSetup row", async (t) => {
  setupEnvironment(t);
  const selected = employee();
  const issuedAt = Math.floor(Date.now() / 1000) - 120;
  const jti = randomUUID();
  // Reproduce the pre-consolidation token envelope independently of the current issuer.
  const token = await new SignJWT({ scope: "teacher-invitation", email: selected.emailAddress })
    .setProtectedHeader({ alg: "HS256" }).setSubject(selected.id.toString()).setJti(jti)
    .setIssuer("isms-teacher-invitation").setAudience("teacher-activation").setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600).sign(new TextEncoder().encode(testSecret));
  const migrated: Invitation = { id: 1n, jti, purpose: "teacherSetup", userId: null, employeeId: selected.id,
    createdAt: new Date(issuedAt * 1000), expiresAt: new Date((issuedAt + 3600) * 1000), consumedAt: null };
  const otherTokens = userVerificationTokens();
  const existing = account();
  const harness = serviceHarness({ users: [existing], tokens: [migrated, ...otherTokens] });
  assert.ok(await harness.activation.getTeacherActivationRecord(token));
  assert.equal((await harness.activation.activateTeacher(initialState, form({ token, ...credentials }))).success, true);
  assert.deepEqual(harness.database.tokens.filter((row) => row.purpose !== "teacherSetup"), otherTokens);
  assert.deepEqual(harness.database.users[0], existing);
  assert.equal(harness.database.users[1].role, "teacher");
  assert.deepEqual(harness.database.teachers, [{ employeeId: selected.id, userId: harness.database.users[1].id }]);
  assert.ok(harness.database.tokens.find((row) => row.jti === jti)?.consumedAt);
  const consumption = harness.calls.find((call) => call.method === "verificationToken.updateMany")?.query.where;
  assert.equal(consumption?.purpose, "teacherSetup");
  assert.equal(consumption?.userId, null);
  assert.equal(consumption?.employeeId, selected.id);
});

test("deleted employees, changed roles, resigned status and changed email addresses invalidate account setup", async (t) => {
  setupEnvironment(t);
  const { selected, issued, invitation } = await setupRecord();
  for (const employees of [[], [{ ...selected, role: "admin" as const }], [{ ...selected, role: "nonTeaching" as const }], [{ ...selected, status: "Resigned" as const }], [{ ...selected, emailAddress: "new-address@example.test" }]]) {
    const harness = serviceHarness({ employees, tokens: [invitation] });
    assert.equal(await harness.activation.getTeacherActivationRecord(issued.token), null);
    assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
    assert.equal(harness.database.tokens[0].consumedAt, null);
    assert.equal(harness.database.users.length, 0);
    assert.equal(harness.database.teachers.length, 0);
    assert.equal(harness.passwords.length, 0);
  }
});

test("accounts created after email delivery block activation for every role without takeover", async (t) => {
  setupEnvironment(t);
  const { selected, issued, invitation } = await setupRecord();
  for (const role of Object.values(UserRole)) {
    const existing = account({ email: selected.emailAddress.toUpperCase(), role });
    const harness = serviceHarness({ users: [existing], tokens: [invitation] });
    assert.equal(await harness.activation.getTeacherActivationRecord(issued.token), null);
    assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
    assert.deepEqual(harness.database.users, [existing]);
    assert.equal(harness.database.teachers.length, 0);
    assert.equal(harness.database.tokens[0].consumedAt, null);
    assert.equal(harness.passwords.length, 0);
  }
});

test("employee links created after delivery prevent another teacher account", async (t) => {
  setupEnvironment(t);
  const { selected, issued, invitation } = await setupRecord();
  const existing = account({ email: "other@example.test", role: "teacher" });
  const harness = serviceHarness({ users: [existing], teachers: [{ employeeId: selected.id, userId: existing.id }], tokens: [invitation] });
  assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
  assert.deepEqual(harness.database.users, [existing]);
  assert.equal(harness.database.teachers.length, 1);
  assert.equal(harness.database.tokens[0].consumedAt, null);
});

test("password errors leave the setup email reusable and create no accounts", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  for (const fields of [{ password: "Weakpassword1", confirmPassword: "Weakpassword1" }, { password: "Teacher123!", confirmPassword: "Different123!" }, { password: "A1!" + "a".repeat(70), confirmPassword: "A1!" + "a".repeat(70) }]) {
    const harness = serviceHarness({ tokens: [invitation] });
    assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...fields }))).success, false);
    assert.equal(harness.database.users.length, 0);
    assert.equal(harness.database.teachers.length, 0);
    assert.equal(harness.database.tokens[0].consumedAt, null);
    assert.equal(harness.passwords.length, 0);
  }
});

test("failed account or teacher link writes roll back token consumption and both records", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  for (const writeFailure of ["user", "teacher"] as const) {
    const harness = serviceHarness({ tokens: [invitation], writeFailure });
    assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
    assert.equal(harness.database.users.length, 0);
    assert.equal(harness.database.teachers.length, 0);
    assert.equal(harness.database.tokens[0].consumedAt, null);
    assert.ok(await harness.activation.getTeacherActivationRecord(issued.token));
    assert.equal(harness.revalidated.length, 0);
  }
});

test("losing the conditional token-consumption race cannot create a user or teacher link", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  const harness = serviceHarness({ tokens: [invitation], consumeMiss: true });
  assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
  assert.equal(harness.database.users.length, 0);
  assert.equal(harness.database.teachers.length, 0);
  assert.equal(harness.calls.some((call) => call.method === "user.create" || call.method === "teacher.create"), false);
});

test("missing employee row lock rejects activation before hashing or account creation", async (t) => {
  setupEnvironment(t);
  const { issued, invitation } = await setupRecord();
  const harness = serviceHarness({ tokens: [invitation], lockMiss: true });
  assert.equal((await harness.activation.activateTeacher(initialState, form({ token: issued.token, ...credentials }))).success, false);
  assert.equal(harness.passwords.length, 0);
  assert.equal(harness.database.users.length, 0);
  assert.equal(harness.database.tokens[0].consumedAt, null);
});
