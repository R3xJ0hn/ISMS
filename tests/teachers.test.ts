import assert from "node:assert/strict";
import test from "node:test";
import { parseTeacherActivationForm, parseTeacherEmployeeId, parseTeacherInvitationForm } from "../lib/teachers/validation";
import { form } from "./teacher-services-harness";

test("teacher setup selects an employee by exact bigint ID and ignores client account overrides", () => {
  const parsed = parseTeacherInvitationForm(form({ employeeRecordId: "9007199254740993", email: "attacker@example.test", role: "superAdmin", password: "ignored" }));
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail("Employee selection rejected");
  assert.equal(parsed.employeeId, 9007199254740993n);
  assert.deepEqual(Object.keys(parsed), ["success", "employeeId"]);
  assert.equal(parseTeacherEmployeeId("9223372036854775807"), 9223372036854775807n);
});

test("teacher setup rejects missing, malformed, nonpositive and out-of-range employee IDs", () => {
  for (const employeeRecordId of ["", "0", "-1", "+1", "01", "1.0", "1e2", "1x", "9223372036854775808", "9".repeat(1000)]) {
    assert.equal(parseTeacherEmployeeId(employeeRecordId), null);
    const parsed = parseTeacherInvitationForm(form({ employeeRecordId }));
    assert.equal(parsed.success, false);
    if (parsed.success) assert.fail("Invalid employee selected");
    assert.ok(parsed.fieldErrors?.employeeRecordId);
  }
  const file = form(); file.set("employeeRecordId", new Blob(["1"]), "id.txt");
  assert.equal(parseTeacherInvitationForm(file).success, false);
});

test("teacher activation keeps password and token bytes unchanged while ignoring privileged fields", () => {
  const password = " <Teacher123!> ";
  const parsed = parseTeacherActivationForm(form({ token: "signed.payload.signature", password, confirmPassword: password, role: "admin", emailVerified: "false" }));
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail("Valid setup rejected");
  assert.equal(parsed.password, password);
  assert.equal(parsed.token, "signed.payload.signature");
  assert.deepEqual(Object.keys(parsed), ["success", "token", "password"]);
});

test("teacher activation enforces password complexity, exact confirmation and bcrypt byte limits", () => {
  for (const password of ["", "Short1!", "onlylower1!", "ONLYUPPER1!", "NoDigits!!", "NoSpecial123", "A1!" + "a".repeat(70), "A1!" + "é".repeat(35)]) {
    const parsed = parseTeacherActivationForm(form({ token: "signed.token", password, confirmPassword: password }));
    assert.equal(parsed.success, false);
    if (parsed.success) assert.fail("Invalid password accepted");
    assert.ok(parsed.fieldErrors?.password);
  }
  const mismatch = parseTeacherActivationForm(form({ token: "signed.token", password: "Teacher123!", confirmPassword: "Teacher123! " }));
  assert.equal(mismatch.success, false);
  if (mismatch.success) assert.fail("Mismatched password accepted");
  assert.equal(mismatch.fieldErrors?.confirmPassword, "Passwords do not match.");
  const boundary = "A1!" + "a".repeat(69);
  assert.equal(parseTeacherActivationForm(form({ token: "signed.token", password: boundary, confirmPassword: boundary })).success, true);
});

test("teacher activation rejects files, missing confirmation and oversized token values", () => {
  for (const name of ["token", "password", "confirmPassword"]) {
    const data = form({ token: "signed.token", password: "Teacher123!", confirmPassword: "Teacher123!" });
    data.set(name, new Blob(["ignored"]), "upload.txt");
    assert.equal(parseTeacherActivationForm(data).success, false);
  }
  assert.equal(parseTeacherActivationForm(form({ token: "x".repeat(4097), password: "Teacher123!", confirmPassword: "Teacher123!" })).success, false);
  assert.equal(parseTeacherActivationForm(form({ token: "signed.token", password: "Teacher123!" })).success, false);
});
