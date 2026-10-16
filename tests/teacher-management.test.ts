import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { UserRole } from "../lib/generated/prisma/enums";
import { verifyTeacherInvitationToken } from "../lib/auth/tokens";
import { account, employee, form, initialState, serviceHarness, setupEnvironment, userVerificationTokens, type Invitation } from "./teacher-services-harness";

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return { id: 1n, jti: randomUUID(), purpose: "teacherSetup", userId: null, employeeId: employee().id, createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() + 3_600_000), consumedAt: null, ...overrides };
}

test("all teacher management services authorize superadmin before reading form or database", async () => {
  for (const method of ["getTeacherEmployees", "getTeacherEmployeeForInvitation", "inviteTeacher"] as const) {
    const harness = serviceHarness({ denied: true });
    await assert.rejects(async () => {
      if (method === "getTeacherEmployees") await harness.admin[method]();
      else if (method === "getTeacherEmployeeForInvitation") await harness.admin[method]("invalid");
      else await harness.admin[method](initialState, { get: () => assert.fail("Unauthorized form parsed") } as unknown as FormData);
    }, /Denied/);
    assert.equal(harness.guards, 1);
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.delivered.length, 0);
  }
});

test("teacher list reads teacher employees and returns only overview fields and activation status", async () => {
  const main = employee({ middleName: "Elena", suffix: "Jr." });
  const staff = employee({ id: 2n, role: "admin", employeeId: "STAFF", emailAddress: "staff@example.test" });
  const conflict = employee({ id: 3n, emailAddress: "existing@example.test" });
  const harness = serviceHarness({ employees: [main, staff, conflict], users: [account()] });
  const rows = await harness.admin.getTeacherEmployees();
  assert.deepEqual(rows.map((row) => row.employeeRecordId), [main.id.toString(), "3"]);
  assert.equal(rows[0].accountStatus, "Not Activated");
  assert.equal(rows[0].fullName, "Maria Elena Santos Jr.");
  assert.equal(rows[1].accountStatus, "Account Conflict");
  assert.deepEqual(Object.keys(rows[0]).sort(), ["employeeRecordId", "employeeId", "fullName", "emailAddress", "contactNumber", "status", "accountStatus", "invitationCreatedAt"].sort());
  const selection = JSON.stringify(harness.calls.find((call) => call.method === "employee.findMany")?.query.select);
  for (const field of ["firstName", "middleName", "lastName", "suffix"]) assert.ok(selection.includes(`"${field}":true`), field);
  assert.doesNotMatch(selection, /"fullName"/);
  assert.doesNotMatch(selection, /birthDate|address|tin|sssNo|philHealthNo|pagIbigNo|passwordHash/);
});

test("teacher lists and individual invitation reads hide the protected account email and legacy linked profile", async () => {
  const protectedEmail = "Root_User@Example.TEST";
  const sameEmail = employee({ id: 2n, emailAddress: "root_user@example.test", firstName: "Hidden Email", lastName: "Identity" });
  const linkedProfile = employee({ id: 3n, emailAddress: "old.profile@example.test", firstName: "Hidden Linked", lastName: "Identity" });
  const punctuationNeighbor = employee({ id: 4n, emailAddress: "rootAuser@example.test", firstName: "Visible", lastName: "Neighbor" });
  const ordinaryLinked = employee({ id: 5n, emailAddress: "ordinary.teacher@example.test", firstName: "Ordinary", lastName: "Teacher" });
  const harness = serviceHarness({
    superAdminEmail: protectedEmail,
    employees: [employee(), sameEmail, linkedProfile, punctuationNeighbor, ordinaryLinked],
    users: [account({ id: 1n, email: protectedEmail, role: "superAdmin" }), account({ id: 2n, email: ordinaryLinked.emailAddress, role: "teacher" })],
    teachers: [{ employeeId: linkedProfile.id, userId: 1n }, { employeeId: ordinaryLinked.id, userId: 2n }],
  });
  const rows = await harness.admin.getTeacherEmployees();
  assert.deepEqual(rows.map((row) => row.employeeRecordId), [employee().id.toString(), "4", "5"]);
  assert.equal(rows[2].accountStatus, "Active");
  assert.doesNotMatch(JSON.stringify(rows), /Hidden Email Identity|Hidden Linked Identity|root_user|old\.profile/);
  assert.equal(await harness.admin.getTeacherEmployeeForInvitation(sameEmail.id.toString()), null);
  assert.equal(await harness.admin.getTeacherEmployeeForInvitation(linkedProfile.id.toString()), null);
  assert.equal((await harness.admin.getTeacherEmployeeForInvitation(punctuationNeighbor.id.toString()))?.fullName, "Visible Neighbor");
  const employeeReads = harness.calls.filter((call) => call.method.startsWith("employee.find"));
  assert.ok(employeeReads.every((call) => call.query.where?.NOT?.length === 2));
  assert.equal(harness.calls.filter((call) => call.method === "user.findFirst").length, 1, "Hidden records do not reach account-conflict reads");
});

test("guessed protected teacher employee IDs cannot send setup emails or write tokens", async () => {
  for (const hiddenBy of ["email", "linked account"] as const) {
    const hiddenEmployee = employee({ emailAddress: hiddenBy === "email" ? "ROOT_USER@example.test" : "old.profile@example.test" });
    const harness = serviceHarness({
      employees: [hiddenEmployee],
      users: [account({ id: 1n, email: "root_user@example.test", role: "superAdmin" })],
      teachers: hiddenBy === "linked account" ? [{ employeeId: hiddenEmployee.id, userId: 1n }] : [],
    });
    const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: hiddenEmployee.id.toString() }));
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /root_user|old\.profile|superadmin/i);
    assert.equal(harness.delivered.length, 0);
    assert.equal(harness.database.tokens.length, 0);
    assert.equal(harness.calls.some((call) => /create|update|user\.find/.test(call.method)), false);
    assert.deepEqual(harness.events, ["guard", "employee.lock"]);
  }
});

test("setup button sends only to saved employee email and creates no user or teacher records", async (t) => {
  setupEnvironment(t);
  const selected = employee({ emailAddress: "Maria.Name@Example.TEST", middleName: "Elena", suffix: "Jr." });
  const harness = serviceHarness({ employees: [selected] });
  const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: selected.id.toString(), email: "attacker@example.test", role: "superAdmin", password: "ignored" }));
  assert.equal(result.success, true);
  assert.equal(harness.delivered.length, 1);
  assert.equal(harness.delivered[0].to, "maria.name@example.test");
  assert.equal(harness.delivered[0].fullName, "Maria Elena Santos Jr.");
  const url = new URL(harness.delivered[0].invitationUrl);
  assert.equal(url.origin, "https://portal.example.test");
  assert.equal(url.pathname, "/teacher/activate");
  const claims = await verifyTeacherInvitationToken(url.searchParams.get("token")!);
  assert.ok(claims);
  assert.equal(claims.employeeRecordId, selected.id.toString());
  assert.equal(claims.email, "maria.name@example.test");
  assert.equal(harness.database.tokens[0].jti, claims.jti);
  assert.equal(+harness.database.tokens[0].expiresAt, +claims.expiresAt);
  assert.equal(harness.database.users.length, 0);
  assert.equal(harness.database.teachers.length, 0);
  assert.equal(harness.passwords.length, 0);
  assert.deepEqual(harness.isolations, ["Serializable"]);
  assert.equal(harness.events.at(-1), "send");
});

test("employees with cleared test names remain accessible in teacher lists and account setup", async (t) => {
  setupEnvironment(t);
  const selected = employee({ firstName: null, lastName: null });
  const harness = serviceHarness({ employees: [selected] });
  assert.equal((await harness.admin.getTeacherEmployees())[0].fullName, "Name not set");
  assert.equal((await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: selected.id.toString() }))).success, true);
  assert.equal(harness.delivered[0].fullName, "Name not set");
  const token = new URL(harness.delivered[0].invitationUrl).searchParams.get("token")!;
  assert.equal((await harness.activation.getTeacherActivationRecord(token))?.fullName, "Name not set");
  assert.equal(harness.database.employees[0].firstName, null);
  assert.equal(harness.database.employees[0].lastName, null);
  assert.equal(harness.database.users.length, 0);
});

test("setup button rejects missing, nonteacher and resigned employees without sending or creating accounts", async (t) => {
  setupEnvironment(t);
  for (const employees of [[], [employee({ role: "admin" })], [employee({ role: "nonTeaching" })], [employee({ status: "Resigned" })]]) {
    const harness = serviceHarness({ employees });
    const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.employeeRecordId);
    assert.equal(harness.database.tokens.length, 0);
    assert.equal(harness.database.users.length, 0);
    assert.equal(harness.delivered.length, 0);
  }
});

test("existing login accounts of every role block setup without resetting or promoting them", async (t) => {
  setupEnvironment(t);
  for (const role of Object.values(UserRole)) {
    const existing = account({ email: employee().emailAddress.toUpperCase(), role });
    const harness = serviceHarness({ users: [existing] });
    const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }));
    assert.equal(result.success, false, role);
    assert.deepEqual(harness.database.users, [existing]);
    assert.equal(harness.database.teachers.length, 0);
    assert.equal(harness.database.tokens.length, 0);
    assert.equal(harness.delivered.length, 0);
  }
});

test("literal email punctuation cannot match another account as ILIKE wildcards", async (t) => {
  setupEnvironment(t);
  for (const [selectedEmail, otherEmail] of [["maria_one@example.test", "maria-one@example.test"], ["maria%one@example.test", "mariaotherone@example.test"], ["maria\\one@example.test", "mariaone@example.test"]]) {
    const selected = employee({ emailAddress: selectedEmail });
    const distinct = serviceHarness({ employees: [selected], users: [account({ email: otherEmail })] });
    assert.equal((await distinct.admin.inviteTeacher(initialState, form({ employeeRecordId: selected.id.toString() }))).success, true);
    assert.equal(distinct.delivered[0].to, selectedEmail);
    const matching = serviceHarness({ employees: [selected], users: [account({ email: selectedEmail.toUpperCase() })] });
    assert.equal((await matching.admin.inviteTeacher(initialState, form({ employeeRecordId: selected.id.toString() }))).success, false);
    assert.equal(matching.delivered.length, 0);
  }
});

test("linked employees cannot receive another account setup email", async (t) => {
  setupEnvironment(t);
  const selected = employee();
  const existing = account({ email: selected.emailAddress, role: "teacher" });
  const harness = serviceHarness({ users: [existing], teachers: [{ employeeId: selected.id, userId: existing.id }] });
  const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: selected.id.toString() }));
  assert.equal(result.success, false);
  assert.equal(harness.delivered.length, 0);
  assert.equal(harness.database.tokens.length, 0);
  assert.equal((await harness.admin.getTeacherEmployees())[0].accountStatus, "Active");
});

test("resend cooldown keeps the current setup token intact", async (t) => {
  setupEnvironment(t);
  const current = invitation({ createdAt: new Date() });
  const harness = serviceHarness({ tokens: [current] });
  const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }));
  assert.equal(result.success, false);
  assert.match(result.message, /60 seconds/);
  assert.deepEqual(harness.database.tokens, [current]);
  assert.equal(harness.delivered.length, 0);
});

test("resending replaces only that employee's old tokens", async (t) => {
  setupEnvironment(t);
  const older = invitation();
  const other = invitation({ id: 2n, employeeId: 2n });
  const harness = serviceHarness({ tokens: [older, other] });
  const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }));
  assert.equal(result.success, true);
  assert.ok(harness.database.tokens.find((row) => row.jti === older.jti)?.consumedAt);
  assert.equal(harness.database.tokens.find((row) => row.jti === other.jti)?.consumedAt, null);
  assert.equal(harness.database.tokens.filter((row) => row.employeeId === employee().id && row.consumedAt === null).length, 1);
  assert.equal(harness.database.users.length, 0);
});

test("administrator teacher resends preserve user verification and recovery rows despite their recent creation", async (t) => {
  setupEnvironment(t);
  const userTokens = userVerificationTokens();
  const older = invitation();
  const harness = serviceHarness({ tokens: [older, ...userTokens] });
  const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }));
  assert.equal(result.success, true, "Recent tokens for other purposes must not trigger the teacher cooldown");
  assert.deepEqual(harness.database.tokens.filter((row) => row.purpose !== "teacherSetup"), userTokens);
  assert.ok(harness.database.tokens.find((row) => row.jti === older.jti)?.consumedAt);
  const pending = harness.database.tokens.find((row) => row.purpose === "teacherSetup" && row.consumedAt === null);
  assert.ok(pending);
  assert.equal(pending.userId, null);
  assert.equal(pending.employeeId, employee().id);
  for (const call of harness.calls.filter((call) => call.method.startsWith("verificationToken."))) {
    const scope = call.method.endsWith("create") ? call.query.data : call.query.where;
    assert.equal(scope?.purpose, "teacherSetup", call.method);
    assert.equal(scope?.userId, null, call.method);
    assert.equal(scope?.employeeId, employee().id, call.method);
  }
});

test("administrator setup delivery cleanup preserves all other verification purposes and its older consumed setup row", async (t) => {
  setupEnvironment(t);
  const older = invitation();
  const userTokens = userVerificationTokens();
  const harness = serviceHarness({ tokens: [older, ...userTokens], deliveryFailure: true });
  assert.equal((await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }))).success, false);
  assert.deepEqual(harness.database.tokens.filter((row) => row.purpose !== "teacherSetup"), userTokens);
  assert.ok(harness.database.tokens.find((row) => row.jti === older.jti)?.consumedAt);
  assert.equal(harness.database.tokens.filter((row) => row.purpose === "teacherSetup").length, 1);
  const deletion = harness.calls.find((call) => call.method === "verificationToken.deleteMany")?.query.where;
  assert.equal(deletion?.purpose, "teacherSetup");
  assert.equal(deletion?.userId, null);
  assert.equal(deletion?.employeeId, employee().id);
  assert.notEqual(deletion?.jti, older.jti);
  assert.equal(harness.database.users.length, 0);
  assert.equal(harness.database.teachers.length, 0);
});

test("failed delivery removes only the newly issued pending token and never creates accounts", async (t) => {
  setupEnvironment(t);
  const other = invitation({ employeeId: 2n });
  const harness = serviceHarness({ tokens: [other], deliveryFailure: true });
  const result = await harness.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }));
  assert.equal(result.success, false);
  assert.deepEqual(harness.database.tokens, [other]);
  assert.equal(harness.database.users.length, 0);
  assert.equal(harness.database.teachers.length, 0);
  const deletion = harness.calls.find((call) => call.method === "verificationToken.deleteMany")?.query.where;
  assert.equal(deletion?.employeeId, employee().id);
  assert.equal(deletion?.consumedAt, null);
  assert.ok(deletion?.jti);
});

test("storage and URL configuration failures roll back setup ledger changes", async (t) => {
  setupEnvironment(t);
  const older = invitation();
  const failed = serviceHarness({ tokens: [older], writeFailure: "invitation" });
  assert.equal((await failed.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }))).success, false);
  assert.deepEqual(failed.database.tokens, [older]);
  assert.equal(failed.delivered.length, 0);
  process.env.APP_URL = "http://insecure.example.test";
  const misconfigured = serviceHarness();
  assert.equal((await misconfigured.admin.inviteTeacher(initialState, form({ employeeRecordId: employee().id.toString() }))).success, false);
  assert.equal(misconfigured.database.tokens.length, 0);
  assert.equal(misconfigured.delivered.length, 0);
});

test("teacher detail lookup rejects invalid, missing and nonteacher employee IDs", async () => {
  const harness = serviceHarness();
  assert.equal(await harness.admin.getTeacherEmployeeForInvitation("invalid"), null);
  assert.equal(harness.calls.length, 0);
  assert.equal(await harness.admin.getTeacherEmployeeForInvitation("1"), null);
  const staff = serviceHarness({ employees: [employee({ role: "admin" })] });
  assert.equal(await staff.admin.getTeacherEmployeeForInvitation(employee().id.toString()), null);
  assert.equal((await harness.admin.getTeacherEmployeeForInvitation(employee().id.toString()))?.employeeRecordId, employee().id.toString());
});
