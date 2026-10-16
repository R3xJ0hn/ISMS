import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import nodemailer from "nodemailer";
import { Resend } from "resend";

import { sendEmail } from "../lib/email";
import { buildStudentUpdateEmail, sendStudentUpdateLinkEmail } from "../lib/admission/student-update-email";

const environmentKeys = [
  "NODE_ENV", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM_EMAIL",
  "RESEND_API_KEY", "RESEND_FROM_EMAIL",
] as const;
const environment = process.env as Record<string, string | undefined>;

function configureEnvironment(t: TestContext, values: Record<string, string> = {}) {
  const previous = Object.fromEntries(environmentKeys.map((key) => [key, environment[key]]));
  for (const key of environmentKeys) delete environment[key];
  Object.assign(environment, { NODE_ENV: "production", ...values });
  t.after(() => {
    for (const key of environmentKeys) {
      if (previous[key] === undefined) delete environment[key];
      else environment[key] = previous[key];
    }
  });
}

const message = {
  to: "student@example.com", subject: "Portal update", html: "<p>Update</p>", text: "Update",
};

test("student email escapes HTML names and URLs and removes control characters from names", (t) => {
  configureEnvironment(t);
  const email = buildStudentUpdateEmail(
    " \u0000Ana & <Santos> \"Maria\" 'Jr'\r\n\u007F ",
    "https://school.example/update?token=abc&return=profile"
  );
  assert.equal(email.subject, "Update your DCSA student information");
  assert.match(email.html, /Ana &amp; &lt;Santos&gt; &quot;Maria&quot; &#39;Jr&#39;/);
  assert.match(email.html, /href="https:\/\/school\.example\/update\?token=abc&amp;return=profile"/);
  assert.equal(email.text.split("\n")[0], "Hello Ana & <Santos> \"Maria\" 'Jr',");
  assert.match(email.text, /https:\/\/school\.example\/update\?token=abc&return=profile/);
  assert.match(email.text, /This link expires in 1 hour\./);
});

test("student email permits HTTP only in development and rejects malformed or unsafe URLs", (t) => {
  configureEnvironment(t);
  for (const url of ["http://school.example/update", "javascript:alert(1)", "not a URL"]) {
    assert.throws(() => buildStudentUpdateEmail("Ana", url), { message: "Student update URL is invalid." });
  }
  environment.NODE_ENV = "development";
  assert.match(buildStudentUpdateEmail("Ana", "http://localhost:3000/update").html, /http:\/\/localhost:3000\/update/);
  assert.throws(() => buildStudentUpdateEmail("Ana", "ftp://school.example/update"), { message: "Student update URL is invalid." });
});

for (const [port, expectedPort, secure] of [["465", 465, true], [undefined, 587, false]] as const) {
  test(`SMTP takes precedence and uses ${expectedPort} with the configured sender`, async (t) => {
    configureEnvironment(t, {
      SMTP_HOST: "smtp.example.com", SMTP_USER: "user", SMTP_PASS: "password",
      SMTP_FROM_EMAIL: "SMTP <smtp@example.com>", RESEND_FROM_EMAIL: "Resend <resend@example.com>",
      RESEND_API_KEY: "offline-test-key", ...(port ? { SMTP_PORT: port } : {}),
    });
    const sendMail = t.mock.fn(async (deliveredMessage: unknown) => deliveredMessage);
    const createTransport = t.mock.method(nodemailer, "createTransport", () => ({ sendMail }));
    const resendPost = t.mock.method(Resend.prototype, "post", async () => { throw new Error("Unexpected Resend call."); });
    await sendEmail(message);
    assert.equal(resendPost.mock.callCount(), 0);
    assert.deepEqual(createTransport.mock.calls[0].arguments[0], {
      host: "smtp.example.com", port: expectedPort, secure, auth: { user: "user", pass: "password" },
    });
    assert.deepEqual(sendMail.mock.calls[0].arguments[0], { from: "SMTP <smtp@example.com>", ...message });
  });
}

test("Resend uses the sender fallback chain when SMTP is absent", async (t) => {
  configureEnvironment(t, { RESEND_API_KEY: "offline-test-key", RESEND_FROM_EMAIL: "Resend <resend@example.com>" });
  const post = t.mock.method(Resend.prototype, "post", async () => ({ data: { id: "offline" }, error: null }));
  const createTransport = t.mock.method(nodemailer, "createTransport", () => { throw new Error("Unexpected SMTP call."); });
  const expectedSenders = ["Resend <resend@example.com>", "SMTP <smtp@example.com>", "Portal <onboarding@resend.dev>"];
  for (const [index, sender] of expectedSenders.entries()) {
    if (index === 1) environment.SMTP_FROM_EMAIL = sender;
    if (index === 2) {
      delete environment.SMTP_FROM_EMAIL;
      delete environment.RESEND_FROM_EMAIL;
    }
    await sendEmail(message);
    const [path, payload] = post.mock.calls[index].arguments;
    assert.equal(path, "/emails");
    assert.equal((payload as { from: string }).from, sender);
  }
  assert.equal(createTransport.mock.callCount(), 0);
});

test("invalid SMTP configuration and missing Resend keys retain their existing errors", async (t) => {
  configureEnvironment(t, { SMTP_HOST: "smtp.example.com", SMTP_USER: "user" });
  const createTransport = t.mock.method(nodemailer, "createTransport", () => { throw new Error("Unexpected SMTP call."); });
  const post = t.mock.method(Resend.prototype, "post", async () => { throw new Error("Unexpected Resend call."); });
  const smtpError = { message: "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured for SMTP email." };
  await assert.rejects(sendEmail(message), smtpError);
  environment.SMTP_PASS = "password";
  environment.SMTP_PORT = "invalid";
  await assert.rejects(sendEmail(message), smtpError);
  delete environment.SMTP_HOST;
  await assert.rejects(sendEmail(message), { message: "RESEND_API_KEY is not configured." });
  assert.equal(createTransport.mock.callCount(), 0);
  assert.equal(post.mock.callCount(), 0);
});

test("provider errors propagate and student emails retain their original fallback message", async (t) => {
  configureEnvironment(t, { RESEND_API_KEY: "offline-test-key" });
  const post = t.mock.method(Resend.prototype, "post", async () => ({ data: null, error: { message: "Provider rejected the email." } }));
  await assert.rejects(sendEmail(message), { message: "Provider rejected the email." });
  post.mock.mockImplementation(async () => ({ data: null, error: { message: "" } }));
  await assert.rejects(sendEmail(message), { message: "Failed to send the email." });
  await assert.rejects(sendStudentUpdateLinkEmail({
    to: message.to, studentName: "Ana", updateUrl: "https://school.example/update",
  }), { message: "Failed to send the update link email." });
});

test("SMTP delivery failures propagate without trying Resend", async (t) => {
  configureEnvironment(t, { SMTP_HOST: "smtp.example.com", SMTP_USER: "user", SMTP_PASS: "password" });
  const failure = new Error("SMTP delivery failed.");
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async () => { throw failure; } }));
  const post = t.mock.method(Resend.prototype, "post", async () => { throw new Error("Unexpected Resend call."); });
  await assert.rejects(sendEmail(message), (error) => error === failure);
  assert.equal(post.mock.callCount(), 0);
});
