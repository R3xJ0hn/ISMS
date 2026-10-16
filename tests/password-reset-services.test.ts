import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { UserRole } from "../lib/generated/prisma/enums";
import { account, form, passwordForm, seedReset, serviceHarness, setupEnvironment, state, type Token } from "./password-reset-harness";

const response = { success: true, message: "If your email is registered with the school, we’ve sent instructions to set or reset your password." };
function otherToken(overrides: Partial<Token> = {}): Token {
  return { id: 99n, jti: randomUUID(), userId: account().id, purpose: "passwordReset", createdAt: new Date(Date.now() - 120_000),
    expiresAt: new Date(Date.now() + 1800_000), consumedAt: null, ...overrides };
}

test("reset requests give the same generic padded response for unknown, ambiguous, throttled and failed accounts", async (t) => {
  setupEnvironment(t);
  for (const options of [
    { users: [] }, { users: [account(), account({ id: 2n, email: "PERSON@EXAMPLE.TEST" })] },
    { allowed: false }, { rateFailure: true }, { deliveryFailure: true }, { createFailure: true }, {},
  ]) {
    const subject = serviceHarness(options);
    assert.deepEqual(await subject.service.requestPasswordReset(state, form({ email: account().email })), response);
    assert.equal(subject.delays.length, 1);
    assert.ok(subject.delays[0] > 0 && subject.delays[0] <= 200);
    assert.equal(subject.emails.length, 0, "SMTP delivery must happen after the generic response");
    assert.equal(subject.calls.length, 0, "Registration-dependent user/token queries must happen after the response");
    assert.equal(subject.events[0], "rate");
    await subject.runAfter();
    assert.equal(subject.database.users.length, options.users?.length ?? 1);
    assert.equal(subject.logs.length, 0);
  }
});

test("request validation rejects malformed email before rate buckets or account queries", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness();
  const result = await subject.service.requestPasswordReset(state, form({ email: "invalid" }));
  assert.equal(result.success, false);
  assert.ok(result.fieldErrors?.email);
  assert.equal(subject.calls.length, 0);
  assert.equal(subject.events.length, 0);
  assert.equal(subject.delays.length, 0);
});

test("requests use only the submitted normalized email and bind links to existing locked users", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness();
  const result = await subject.service.requestPasswordReset(state, form({
    email: " PERSON@Example.TEST ", userId: "2", role: "superAdmin", password: "Injected1!", url: "https://attacker.test", sessionVersion: "10",
  }));
  assert.deepEqual(result, response);
  assert.equal(subject.calls.length, 0);
  assert.equal(subject.database.tokens.length, 0);
  assert.equal(subject.scheduled.length, 1);
  await subject.runAfter();
  assert.equal(subject.database.tokens.length, 1);
  assert.equal(subject.database.tokens[0].userId, account().id);
  assert.equal(subject.database.tokens[0].purpose, "passwordReset");
  assert.equal(subject.database.users[0].passwordHash, account().passwordHash);
  assert.ok(subject.events.indexOf("user.lock") < subject.events.indexOf("token.create"));
  assert.equal(subject.emails[0].to, account().email);
  assert.match(subject.emails[0].resetUrl, /^https:\/\/portal.example.test\/reset-password\?token=/);
  const token = new URL(subject.emails[0].resetUrl).searchParams.get("token")!;
  assert.deepEqual(await subject.service.getPasswordResetRecord(token), { email: account().email });
  assert.doesNotMatch(JSON.stringify(result), /token|original-credential-hash|900719/);
});

test("request cooldown and resends change only the user's password-reset tokens", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness();
  await seedReset(subject);
  subject.database.tokens[0].createdAt = new Date();
  assert.deepEqual(await subject.service.requestPasswordReset(state, form({ email: account().email })), response);
  assert.equal(subject.scheduled.length, 1);
  assert.equal(subject.calls.length, 0);
  await subject.runAfter();
  assert.equal(subject.emails.length, 0);
  assert.equal(subject.database.tokens[0].consumedAt, null);
  subject.database.tokens[0].createdAt = new Date(Date.now() - 120_000);
  subject.database.tokens.push(otherToken({ purpose: "studentUpdate" }), otherToken({ purpose: "emailVerification" }), otherToken({ userId: 5n }));
  const untouched = structuredClone(subject.database.tokens.slice(1));
  assert.deepEqual(await subject.service.requestPasswordReset(state, form({ email: account().email })), response);
  await subject.runAfter();
  assert.notEqual(subject.database.tokens[0].consumedAt, null);
  assert.deepEqual(subject.database.tokens.slice(1, 4), untouched);
  assert.equal(subject.database.tokens.length, 5);
});

test("failed reset email delivery removes only its own pending token after the response", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness({ deliveryFailure: true, tokens: [otherToken({ purpose: "emailVerification" }), otherToken({ userId: 2n })] });
  const previous = structuredClone(subject.database.tokens);
  assert.deepEqual(await subject.service.requestPasswordReset(state, form({ email: account().email })), response);
  assert.equal(subject.database.tokens.length, 2);
  assert.equal(subject.calls.length, 0);
  await subject.runAfter();
  assert.equal(subject.calls.some((call) => call.method === "token.create"), true);
  assert.deepEqual(subject.database.tokens, previous);
  const cleanup = subject.calls.find((call) => call.method === "token.deleteMany")?.query.where;
  assert.equal(cleanup?.purpose, "passwordReset");
  assert.equal(cleanup?.userId, account().id);
  assert.equal(cleanup?.consumedAt, null);
  assert.equal(typeof cleanup?.jti, "string");
});

test("background lookup, signing and storage failures stay private and roll back old-token revocation", async (t) => {
  setupEnvironment(t);
  for (const options of [{ createFailure: true }, { lockFailure: true }, { lockMiss: true }]) {
    const subject = serviceHarness(options);
    await seedReset(subject);
    subject.database.tokens.push(otherToken({ purpose: "emailVerification" }));
    const before = structuredClone(subject.database);
    const result = await subject.service.requestPasswordReset(state, form({ email: account().email }));
    assert.deepEqual(result, response);
    assert.equal(subject.calls.length, 0);
    await subject.runAfter();
    assert.deepEqual(subject.database, before);
    assert.equal(subject.emails.length, 0);
    assert.equal(subject.logs.length, 0);
  }
  const subject = serviceHarness();
  await seedReset(subject);
  const before = structuredClone(subject.database);
  assert.deepEqual(await subject.service.requestPasswordReset(state, form({ email: account().email })), response);
  process.env.PASSWORD_RESET_SECRET = "short";
  await subject.runAfter();
  assert.deepEqual(subject.database, before);
  assert.equal(subject.emails.length, 0);
  assert.equal(subject.logs.length, 0);
});

test("request email equality treats percent, underscores and backslashes literally", async (t) => {
  setupEnvironment(t);
  for (const [requested, existing] of [
    ["maria_smith@example.test", "maria-smith@example.test"], ["maria%smith@example.test", "maria-long-smith@example.test"],
    ["maria\\_smith@example.test", "maria_smith@example.test"],
  ]) {
    const absent = serviceHarness({ users: [account({ email: existing })] });
    assert.deepEqual(await absent.service.requestPasswordReset(state, form({ email: requested })), response);
    assert.equal(absent.scheduled.length, 1);
    assert.equal(absent.calls.length, 0);
    await absent.runAfter();
    assert.equal(absent.emails.length, 0);
    const present = serviceHarness({ users: [account({ email: requested.toUpperCase() })] });
    assert.deepEqual(await present.service.requestPasswordReset(state, form({ email: requested })), response);
    assert.equal(present.scheduled.length, 1);
    await present.runAfter();
    assert.equal(present.emails[0].to, requested);
  }
});

test("read-only reset previews reject purpose, target, expiry, consumption and credential mismatches", async (t) => {
  setupEnvironment(t);
  for (const overrides of [
    { purpose: "emailVerification" }, { purpose: "teacherSetup", userId: null, employeeId: 44n }, { userId: null }, { userId: 2n }, { consumedAt: new Date() },
    { expiresAt: new Date(0) }, { expiresAt: new Date(Date.now() + 3600_000) },
  ]) {
    const subject = serviceHarness();
    const issued = await seedReset(subject, overrides);
    assert.equal(await subject.service.getPasswordResetRecord(issued.token), null);
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
    assert.equal(subject.passwords.length, 0);
    assert.equal(subject.calls.some((call) => /updateMany|create|deleteMany/.test(call.method)), false);
  }
  for (const change of [{ email: "changed@example.test" }, { passwordHash: "independently-changed-hash" }, { sessionVersion: 1 }]) {
    const subject = serviceHarness();
    const issued = await seedReset(subject);
    Object.assign(subject.database.users[0], change);
    assert.equal(await subject.service.getPasswordResetRecord(issued.token), null);
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
    assert.equal(subject.passwords.length, 0);
    assert.equal(subject.database.tokens[0].consumedAt, null);
  }
});

test("reset works for every role, proves the current email and invalidates sessions without account promotion", async (t) => {
  setupEnvironment(t);
  for (const role of Object.values(UserRole)) {
    const subject = serviceHarness({ users: [account({ role })] });
    const issued = await seedReset(subject);
    const oldOther = otherToken();
    const student = otherToken({ purpose: "studentUpdate" });
    const verification = otherToken({ purpose: "emailVerification" });
    const teacherSetup = otherToken({ purpose: "teacherSetup", userId: null, employeeId: 44n });
    subject.database.tokens.push(oldOther, student, verification, teacherSetup);
    const originalOtherPurposes = structuredClone(subject.database.tokens.slice(2));
    assert.deepEqual(await subject.service.getPasswordResetRecord(issued.token), { email: account().email });
    assert.equal(subject.calls.some((call) => /updateMany|create|deleteMany/.test(call.method)), false);
    const result = await subject.service.resetPassword(state, passwordForm(issued.token, { userId: "2", role: "superAdmin", email: "attacker@example.test", sessionVersion: "0" }));
    assert.equal(result.success, true, role);
    const user = subject.database.users[0];
    assert.equal(user.role, role);
    assert.equal(user.email, account().email);
    assert.equal(user.emailVerified, true);
    assert.equal(user.sessionVersion, 1);
    assert.equal(user.passwordHash, "offline-bcrypt-hash");
    assert.equal(subject.database.users.length, 1);
    assert.equal(subject.passwords[0], " <Strong123!> ");
    assert.ok(subject.database.tokens[0].consumedAt instanceof Date);
    assert.ok(subject.database.tokens[1].consumedAt instanceof Date);
    assert.deepEqual(subject.database.tokens.slice(2), originalOtherPurposes);
    assert.equal(subject.notifications.length, 0);
    assert.equal(subject.events.includes("user.lock"), true);
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
    assert.equal(user.sessionVersion, 1);
    await subject.runAfter();
    assert.deepEqual(subject.notifications, [{ to: account().email }]);
  }
});

test("reset conditional races and partial failures roll back password, version and token consumption", async (t) => {
  setupEnvironment(t);
  for (const options of [
    { consumeMiss: true }, { updateMiss: true }, { userWriteFailure: true }, { invalidateFailure: true }, { lockMiss: true }, { lockFailure: true },
  ]) {
    const subject = serviceHarness(options);
    const issued = await seedReset(subject);
    subject.database.tokens.push(otherToken());
    const before = structuredClone(subject.database);
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
    assert.deepEqual(subject.database, before);
    assert.equal(subject.scheduled.length, 0);
    assert.equal(subject.logs.length, 0);
  }
});

test("resetting a legacy mixed-case account normalizes its proven email so existing sign-in lookup can find it", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness({ users: [account({ email: "PERSON@EXAMPLE.TEST" })] });
  const issued = await seedReset(subject);
  assert.deepEqual(await subject.service.getPasswordResetRecord(issued.token), { email: "person@example.test" });
  assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, true);
  assert.equal(subject.database.users[0].email, "person@example.test");
  assert.equal(subject.database.users[0].role, "teacher");
  assert.equal(subject.database.users[0].sessionVersion, 1);
  const update = subject.calls.find((call) => call.method === "user.updateMany")?.query;
  assert.equal(update?.where?.email, "PERSON@EXAMPLE.TEST");
  assert.equal(update?.data?.email, "person@example.test");
});

test("a canonical-email uniqueness race rolls back reset without modifying either account or consuming the link", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness({ users: [account({ email: "PERSON@EXAMPLE.TEST" })] });
  const issued = await seedReset(subject);
  subject.database.users.push(account({ id: 2n, email: "person@example.test", role: "admin", passwordHash: "another-account-hash" }));
  const before = structuredClone(subject.database);
  assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, false);
  assert.deepEqual(subject.database, before);
  assert.equal(subject.scheduled.length, 0);
  assert.equal(subject.logs.length, 0);
});

test("password-changed notification failures preserve committed reset and omit secrets from logs", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness({ notificationFailure: true });
  const issued = await seedReset(subject);
  assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token))).success, true);
  await subject.runAfter();
  assert.equal(subject.database.users[0].sessionVersion, 1);
  assert.ok(subject.database.tokens[0].consumedAt instanceof Date);
  assert.deepEqual(subject.logs, [["Failed to send the password-change notification."]]);
  assert.doesNotMatch(JSON.stringify({ notifications: subject.notifications, logs: subject.logs }), /token|hash|Strong123|Private/);
});

test("invalid signed links and invalid raw passwords never reach hashing or user writes", async (t) => {
  setupEnvironment(t);
  const subject = serviceHarness();
  assert.equal(await subject.service.getPasswordResetRecord("forged.token.signature"), null);
  assert.equal((await subject.service.resetPassword(state, passwordForm("forged.token.signature"))).success, false);
  const issued = await seedReset(subject);
  for (const fields of [{ password: "", confirmPassword: "" }, { password: "weak", confirmPassword: "weak" },
    { password: "StrongPass1!", confirmPassword: "StrongPass1! " }, { password: "Aa1!" + "x".repeat(69), confirmPassword: "Aa1!" + "x".repeat(69) }]) {
    assert.equal((await subject.service.resetPassword(state, passwordForm(issued.token, fields))).success, false);
  }
  assert.equal(subject.passwords.length, 0);
  assert.equal(subject.database.tokens[0].consumedAt, null);
});
