import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import nodemailer from "nodemailer";
import { buildPasswordChangedEmail, buildPasswordResetEmail, sendPasswordChangedEmail, sendPasswordResetEmail } from "../lib/auth/email";
import { createPasswordResetToken, createPasswordResetUrl, passwordResetCredentialFingerprint, verifyPasswordResetToken } from "../lib/auth/tokens";
import { account, setupEnvironment, testSecret } from "./password-reset-harness";

function user() { const value = account(); return { ...value, id: value.id.toString() }; }

test("reset JWTs bind account, current email, credential HMAC, session version and a 30-minute lifetime", async (t) => {
  setupEnvironment(t);
  const issued = await createPasswordResetToken(user());
  const claims = await verifyPasswordResetToken(issued.token);
  assert.ok(claims);
  assert.equal(claims.userId, user().id);
  assert.equal(claims.email, user().email);
  assert.equal(claims.sessionVersion, 0);
  assert.equal(claims.jti, issued.jti);
  assert.equal(+claims.expiresAt, +issued.expiresAt);
  const { payload } = await jwtVerify(issued.token, new TextEncoder().encode(testSecret));
  assert.equal(payload.iss, "isms-password-reset");
  assert.equal(payload.aud, "password-reset");
  assert.equal(payload.scope, "password-reset");
  assert.equal(payload.exp! - payload.iat!, 1800);
  assert.match(claims.credentialFingerprint, /^[0-9a-f]{64}$/);
  assert.notEqual(claims.credentialFingerprint, passwordResetCredentialFingerprint("changed-hash"));
  assert.doesNotMatch(JSON.stringify(payload), /original-credential-hash|passwordHash/);
  assert.equal(payload.role, undefined);
  assert.equal(payload.emailVerified, undefined);
});

test("reset tokens reject substitution, malformed bounds, expiry, future issuance and signature tampering", async (t) => {
  setupEnvironment(t);
  const now = Math.floor(Date.now() / 1000);
  const valid = { scope: "password-reset", sub: user().id, email: user().email, sessionVersion: 0,
    credentialFingerprint: passwordResetCredentialFingerprint(user().passwordHash), jti: randomUUID(), iss: "isms-password-reset", aud: "password-reset", iat: now, exp: now + 1800 };
  for (const changes of [
    { scope: "email-verification" }, { scope: "teacher-invitation" }, { aud: "session" }, { iss: "isms" },
    { sub: "0" }, { sub: "9223372036854775808" }, { sub: "9".repeat(1000) }, { jti: "bad" },
    { email: "PERSON@EXAMPLE.TEST" }, { email: "invalid" }, { email: " x@example.test" }, { email: "x\u200b@example.test" },
    { sessionVersion: -1 }, { sessionVersion: 0.5 }, { sessionVersion: "0" }, { sessionVersion: 2147483648 },
    { credentialFingerprint: "A".repeat(64) }, { credentialFingerprint: "x".repeat(64) }, { credentialFingerprint: "abc" },
    { exp: now + 3600 }, { iat: now - 3600, exp: now - 1800 }, { iat: now + 60, exp: now + 1860 }, { iat: now + 0.5, exp: now + 1800.5 },
  ]) {
    const token = await new SignJWT({ ...valid, ...changes }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(testSecret));
    assert.equal(await verifyPasswordResetToken(token), null, JSON.stringify(changes));
  }
  const issued = await createPasswordResetToken(user());
  const [header, payload, signature] = issued.token.split(".");
  const altered = (signature.startsWith("A") ? "B" : "A") + signature.slice(1);
  assert.equal(await verifyPasswordResetToken(`${header}.${payload}.${altered}`), null);
  assert.equal(await verifyPasswordResetToken(" " + issued.token), null);
  assert.equal(await verifyPasswordResetToken("x".repeat(4097)), null);
  const session = await new SignJWT({ email: user().email, role: "teacher", emailVerified: true, sessionVersion: 0 })
    .setProtectedHeader({ alg: "HS256" }).setSubject(user().id).setExpirationTime("1h").sign(new TextEncoder().encode(testSecret));
  assert.equal(await verifyPasswordResetToken(session), null);
});

test("reset credential fingerprints use a server secret and token generation validates account fields", async (t) => {
  setupEnvironment(t);
  const previous = passwordResetCredentialFingerprint(user().passwordHash);
  process.env.PASSWORD_RESET_SECRET = "another-server-secret-at-least-thirty-two-bytes";
  assert.notEqual(passwordResetCredentialFingerprint(user().passwordHash), previous);
  process.env.PASSWORD_RESET_SECRET = "short";
  await assert.rejects(createPasswordResetToken(user()), /32 bytes/);
  delete process.env.PASSWORD_RESET_SECRET;
  const issued = await createPasswordResetToken(user());
  assert.ok(await verifyPasswordResetToken(issued.token));
  for (const changed of [{ id: "0" }, { email: "PERSON@EXAMPLE.TEST" }, { passwordHash: "" }, { sessionVersion: -1 }]) {
    await assert.rejects(createPasswordResetToken({ ...user(), ...changed }));
  }
  delete process.env.JWT_SECRET;
  assert.throws(() => passwordResetCredentialFingerprint("hash"), /32 bytes/);
  assert.equal(await verifyPasswordResetToken(issued.token), null);
});

test("reset URLs require a configured HTTPS origin outside development and encode the signed token", (t) => {
  setupEnvironment(t);
  process.env.APP_URL = "https://portal.example.test/old?discard=yes#old";
  assert.equal(createPasswordResetUrl("abc&token"), "https://portal.example.test/reset-password?token=abc%26token");
  for (const configured of ["http://portal.example.test", "javascript:alert(1)", "https://name:pass@portal.example.test", "ftp://portal.example.test", "bad URL"]) {
    process.env.APP_URL = configured;
    assert.throws(() => createPasswordResetUrl("token"));
  }
  delete process.env.APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://public.example.test/path";
  assert.match(createPasswordResetUrl("token"), /^https:\/\/public.example.test\/reset-password\?/);
  delete process.env.NEXT_PUBLIC_APP_URL;
  process.env.VERCEL_URL = "deployment.example.test";
  assert.match(createPasswordResetUrl("token"), /^https:\/\/deployment.example.test\/reset-password\?/);
  delete process.env.VERCEL_URL;
  assert.throws(() => createPasswordResetUrl("token"));
  Object.assign(process.env, { NODE_ENV: "development" });
  assert.match(createPasswordResetUrl("token"), /^http:\/\/localhost:3000\/reset-password\?/);
});

test("reset emails escape addresses and URLs, and changed-password notices contain no credentials", (t) => {
  setupEnvironment(t);
  const message = buildPasswordResetEmail("person&<tag>\"@example.test", "https://portal.example.test/reset-password?token=one&mode=email");
  assert.match(message.html, /person&amp;&lt;tag&gt;&quot;@example.test/);
  assert.match(message.html, /token=one&amp;mode=email/);
  assert.match(message.text, /expires in 30 minutes/);
  assert.match(message.text, /signs out existing sessions/);
  assert.doesNotMatch(message.html, /<tag>/);
  for (const url of ["http://portal.example.test", "javascript:alert(1)", "https://name:pass@portal.example.test"]) assert.throws(() => buildPasswordResetEmail("person@example.test", url));
  const notification = buildPasswordChangedEmail("person&<tag>@example.test");
  assert.match(notification.html, /person&amp;&lt;tag&gt;/);
  assert.doesNotMatch(notification.html, /<tag>/);
  assert.doesNotMatch(JSON.stringify(notification), /token=|passwordHash|credentialFingerprint|new password is/);
});

test("both reset email wrappers use the existing provider with all delivery mocked", async (t) => {
  setupEnvironment(t);
  const keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, { SMTP_HOST: "smtp.offline.test", SMTP_PORT: "587", SMTP_USER: "offline", SMTP_PASS: "offline", SMTP_FROM_EMAIL: "School <school@example.test>" });
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  const sent: Array<{ to: string; subject: string }> = [];
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async (message: { to: string; subject: string }) => sent.push(message) }));
  await sendPasswordResetEmail({ to: user().email, resetUrl: "https://portal.example.test/reset-password?token=offline" });
  await sendPasswordChangedEmail({ to: user().email });
  assert.equal(sent.length, 2);
  assert.equal(sent[0].to, user().email);
  assert.equal(sent[1].to, user().email);
  assert.notEqual(sent[0].subject, sent[1].subject);
});
