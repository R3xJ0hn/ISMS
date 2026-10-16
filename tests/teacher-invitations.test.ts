import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { buildTeacherInvitationEmail, sendTeacherInvitationEmail } from "../lib/auth/email";
import { createTeacherInvitationToken, createTeacherInvitationUrl, verifyTeacherInvitationToken } from "../lib/auth/tokens";
import { serializeTeacherEmployee, type TeacherEmployeeRecord } from "../lib/teachers/records";
import { employee, setupEnvironment, testSecret } from "./teacher-services-harness";
import nodemailer from "nodemailer";

test("teacher setup token binds the exact employee, email, unique ID and one-hour lifetime", async (t) => {
  setupEnvironment(t);
  const issued = await createTeacherInvitationToken(employee().id.toString(), employee().emailAddress);
  const claims = await verifyTeacherInvitationToken(issued.token);
  assert.ok(claims);
  assert.equal(claims.employeeRecordId, employee().id.toString());
  assert.equal(claims.email, employee().emailAddress);
  assert.equal(claims.jti, issued.jti);
  assert.equal(+claims.expiresAt, +issued.expiresAt);
  const { payload } = await jwtVerify(issued.token, new TextEncoder().encode(testSecret));
  assert.equal(payload.exp! - payload.iat!, 3600);
  assert.equal(payload.iss, "isms-teacher-invitation");
  assert.equal(payload.aud, "teacher-activation");
  assert.equal(payload.scope, "teacher-invitation");
  assert.equal(payload.role, undefined);
  assert.equal(payload.emailVerified, undefined);
});

test("forgot-password teacher setup tokens have a fixed thirty-minute lifetime", async (t) => {
  setupEnvironment(t);
  const issued = await createTeacherInvitationToken(employee().id.toString(), employee().emailAddress, { ttlSeconds: 1800 });
  const claims = await verifyTeacherInvitationToken(issued.token);
  assert.ok(claims);
  assert.equal(claims.employeeRecordId, employee().id.toString());
  assert.equal(claims.email, employee().emailAddress);
  assert.equal(+claims.expiresAt, +issued.expiresAt);
  const { payload } = await jwtVerify(issued.token, new TextEncoder().encode(testSecret));
  assert.equal(payload.exp! - payload.iat!, 1800);
  for (const ttlSeconds of [0, 900, 1799, 1801, 3599, 3601, 7200]) {
    await assert.rejects(createTeacherInvitationToken(employee().id.toString(), employee().emailAddress, { ttlSeconds } as { ttlSeconds: 1800 }));
    const token = await new SignJWT({ ...payload, exp: payload.iat! + ttlSeconds }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(testSecret));
    assert.equal(await verifyTeacherInvitationToken(token), null);
  }
});

test("tampered, expired, future-issued and substituted token types cannot activate teachers", async (t) => {
  setupEnvironment(t);
  const now = Math.floor(Date.now() / 1000);
  const valid = { scope: "teacher-invitation", email: employee().emailAddress, sub: employee().id.toString(), jti: randomUUID(), iss: "isms-teacher-invitation", aud: "teacher-activation", iat: now, exp: now + 3600 };
  for (const overrides of [
    { scope: "email-verification" }, { aud: "email-verification" }, { iss: "isms" }, { sub: "0" }, { sub: "9223372036854775808" },
    { sub: "9".repeat(1000) }, { jti: "not-a-uuid" }, { email: "OTHER@EXAMPLE.TEST" }, { email: "invalid" }, { email: " a@example.test" },
    { exp: now + 7200 }, { iat: now + 60, exp: now + 3660 }, { iat: now - 7200, exp: now - 3600 }, { iat: now + 0.5, exp: now + 3600.5 },
  ]) {
    const token = await new SignJWT({ ...valid, ...overrides }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(testSecret));
    assert.equal(await verifyTeacherInvitationToken(token), null, JSON.stringify(overrides));
  }
  const issued = await createTeacherInvitationToken(employee().id.toString(), employee().emailAddress);
  const [header, payload, signature] = issued.token.split(".");
  const alteredSignature = (signature.startsWith("A") ? "B" : "A") + signature.slice(1);
  assert.equal(await verifyTeacherInvitationToken(`${header}.${payload}.${alteredSignature}`), null);
  assert.equal(await verifyTeacherInvitationToken("x".repeat(4097)), null);
  assert.equal(await verifyTeacherInvitationToken(" " + issued.token), null);
  const session = await new SignJWT({ email: employee().emailAddress, role: "teacher", emailVerified: true }).setProtectedHeader({ alg: "HS256" }).setSubject(employee().id.toString()).setExpirationTime("1h").sign(new TextEncoder().encode(testSecret));
  assert.equal(await verifyTeacherInvitationToken(session), null);
});

test("setup tokens reject invalid inputs and require a strong configured signing secret", async (t) => {
  setupEnvironment(t);
  for (const [id, email] of [["0", "valid@example.test"], ["1", "INVALID@EXAMPLE.TEST"], ["1", "bad-email"], ["1", "x".repeat(321)]]) {
    await assert.rejects(createTeacherInvitationToken(id, email));
  }
  delete process.env.TEACHER_INVITATION_SECRET;
  const issued = await createTeacherInvitationToken("1", "valid@example.test");
  assert.ok(await verifyTeacherInvitationToken(issued.token));
  process.env.TEACHER_INVITATION_SECRET = "short";
  await assert.rejects(createTeacherInvitationToken("1", "valid@example.test"), /32 bytes/);
  assert.equal(await verifyTeacherInvitationToken(issued.token), null);
});

test("setup email URLs use the configured HTTPS origin and HTTP only during development", (t) => {
  setupEnvironment(t);
  assert.equal(createTeacherInvitationUrl("signed.token"), "https://portal.example.test/teacher/activate?token=signed.token");
  for (const configured of ["http://portal.example.test", "javascript:alert(1)", "https://user:pass@portal.example.test", "ftp://portal.example.test", "bad URL"]) {
    process.env.APP_URL = configured;
    assert.throws(() => createTeacherInvitationUrl("token"));
  }
  delete process.env.APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://public.example.test/path";
  assert.match(createTeacherInvitationUrl("token"), /^https:\/\/public.example.test\/teacher\/activate\?/);
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_URL = "deployment.example.test";
  assert.match(createTeacherInvitationUrl("token"), /^https:\/\/deployment.example.test\/teacher\/activate\?/);
  delete process.env.VERCEL_URL;
  assert.throws(() => createTeacherInvitationUrl("token"));
  Object.assign(process.env, { NODE_ENV: "development" });
  assert.match(createTeacherInvitationUrl("token"), /^http:\/\/localhost:3000\/teacher\/activate\?/);
});

test("teacher setup emails escape names and URLs and explain deferred account creation", (t) => {
  setupEnvironment(t);
  const email = buildTeacherInvitationEmail(" Ana & <Santos>\u0000 ", "https://portal.example.test/teacher/activate?token=one&source=email");
  assert.match(email.html, /Ana &amp; &lt;Santos&gt;/);
  assert.match(email.html, /token=one&amp;source=email/);
  assert.match(email.text, /account will be created after you choose your password/);
  assert.match(email.text, /expires in 1 hour/);
  assert.match(email.text, /Your administrator requested an ISMS teacher account for you/);
  assert.doesNotMatch(email.text + email.html, /You requested an ISMS teacher account/);
  assert.doesNotMatch(email.html, /\u0000/);
  for (const url of ["http://portal.example.test", "javascript:alert(1)", "https://user:password@portal.example.test"]) assert.throws(() => buildTeacherInvitationEmail("Ana", url));
});

test("setup email wrapper delivers through the existing email provider with no test network request", async (t) => {
  setupEnvironment(t);
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { SMTP_HOST: "smtp.offline.test", SMTP_PORT: "587", SMTP_USER: "offline", SMTP_PASS: "offline", SMTP_FROM_EMAIL: "School <school@example.test>" });
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  const sent: unknown[] = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message: unknown) => { sent.push(message); } }));
  await sendTeacherInvitationEmail({ to: employee().emailAddress, fullName: "Maria Santos", invitationUrl: "https://portal.example.test/teacher/activate?token=offline" });
  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { to: string }).to, employee().emailAddress);
  assert.match((sent[0] as { html: string }).html, /Verify your email and create your password/);
});

test("teacher account statuses reflect setup expiry, linked email verification and conflicts", () => {
  const profile: TeacherEmployeeRecord = { ...employee(), teacher: null, verificationTokens: [] };
  assert.equal(serializeTeacherEmployee(profile).accountStatus, "Not Activated");
  assert.equal(serializeTeacherEmployee(profile, true).accountStatus, "Account Conflict");
  const pending = { ...profile, verificationTokens: [{ purpose: "teacherSetup" as const, userId: null, employeeId: profile.id,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 3600_000), consumedAt: null }] };
  assert.equal(serializeTeacherEmployee(pending).accountStatus, "Setup Email Sent");
  assert.equal(serializeTeacherEmployee({ ...pending, verificationTokens: [{ ...pending.verificationTokens[0], expiresAt: new Date(Date.now() - 1000) }] }).accountStatus, "Setup Expired");
  const active = { ...profile, teacher: { userId: 1n, user: { email: profile.emailAddress, role: "teacher" as const, emailVerified: true } } };
  assert.equal(serializeTeacherEmployee(active).accountStatus, "Active");
  assert.equal(serializeTeacherEmployee({ ...active, teacher: { ...active.teacher, user: { ...active.teacher.user, emailVerified: false } } }).accountStatus, "Account Conflict");
  assert.equal(serializeTeacherEmployee({ ...active, teacher: { ...active.teacher, user: { ...active.teacher.user, role: "admin" } } }).accountStatus, "Account Conflict");
  assert.equal(serializeTeacherEmployee({ ...active, teacher: { ...active.teacher, user: { ...active.teacher.user, email: "changed@example.test" } } }).accountStatus, "Account Conflict");
});

test("teacher status does not expose timestamps or setup status for borrowed purposes and invalid token targets", () => {
  const profile: TeacherEmployeeRecord = { ...employee(), teacher: null, verificationTokens: [] };
  const base = { purpose: "teacherSetup" as const, userId: null, employeeId: profile.id,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 3600_000), consumedAt: null };
  const unrelated = [
    ...(["passwordReset", "emailVerification", "studentUpdate"] as const).map((purpose) => ({ ...base, purpose, userId: 25n, employeeId: null })),
    { ...base, userId: 25n }, { ...base, employeeId: null }, { ...base, employeeId: 2n },
  ];
  for (const token of unrelated) {
    const row = serializeTeacherEmployee({ ...profile, verificationTokens: [token] });
    assert.equal(row.accountStatus, "Not Activated");
    assert.equal(row.invitationCreatedAt, null);
  }
  const row = serializeTeacherEmployee({ ...profile, verificationTokens: [...unrelated, base] });
  assert.equal(row.accountStatus, "Setup Email Sent");
  assert.equal(row.invitationCreatedAt, base.createdAt.toISOString());
});
