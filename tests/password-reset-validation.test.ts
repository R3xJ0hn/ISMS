import assert from "node:assert/strict";
import test from "node:test";
import { parsePasswordResetRequest, parsePasswordResetSubmission } from "../lib/auth/password-reset-validation";
import { form } from "./password-reset-harness";

test("reset request parsing normalizes email and ignores submitted identity or privilege fields", () => {
  const parsed = parsePasswordResetRequest(form({ email: " PERSON@Example.TEST ", role: "superAdmin", userId: "123", password: "Injected1!" }));
  assert.deepEqual(parsed, { success: true, email: "person@example.test" });
  for (const email of ["", "bad", "user@invalid", "person@exa mple.test", "x".repeat(321) + "@example.test"]) {
    const result = parsePasswordResetRequest(form({ email }));
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors?.email);
  }
});

test("reset submission preserves raw passwords and signed tokens while rejecting weak or incomplete pairs", () => {
  const raw = " <Strong123!> ";
  const parsed = parsePasswordResetSubmission(form({ token: " signed.token ", password: raw, confirmPassword: raw, role: "admin", userId: "2" }));
  assert.deepEqual(parsed, { success: true, token: " signed.token ", password: raw });
  for (const values of [{ password: "" }, { confirmPassword: "" }, { password: "weak", confirmPassword: "weak" }, { confirmPassword: raw.trim() }]) {
    const result = parsePasswordResetSubmission(form({ token: "signed", password: raw, confirmPassword: raw, ...values }));
    assert.equal(result.success, false);
    assert.equal("password" in result, false);
    assert.equal("confirmPassword" in result, false);
  }
});

test("reset passwords enforce the bcrypt UTF-8 byte limit without altering their characters", () => {
  for (const [password, valid] of [["Aa1!" + "x".repeat(68), true], ["Aa1!" + "x".repeat(69), false],
    ["Aa1!" + "é".repeat(34), true], ["Aa1!" + "é".repeat(35), false]] as const) {
    const result = parsePasswordResetSubmission(form({ token: "signed", password, confirmPassword: password }));
    assert.equal(result.success, valid);
    if (result.success) assert.equal(result.password, password);
  }
});

test("reset parsers reject files and missing or oversized tokens", () => {
  const request = form({ email: "person@example.test" });
  request.set("email", new Blob(["forged"]), "email.txt");
  assert.equal(parsePasswordResetRequest(request).success, false);
  for (const token of ["", "x".repeat(4097)]) {
    const result = parsePasswordResetSubmission(form({ token, password: "StrongPass1!", confirmPassword: "StrongPass1!" }));
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors?.token);
  }
  const reset = form({ token: "signed", password: "StrongPass1!", confirmPassword: "StrongPass1!" });
  reset.set("password", new Blob(["forged"]), "password.txt");
  assert.equal(parsePasswordResetSubmission(reset).success, false);
});
