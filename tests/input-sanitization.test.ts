import assert from "node:assert/strict";
import test from "node:test";
import { capitalizeInputText, normalizeEmail, nullableInputText, readFormValue, sanitizeInputText } from "../lib/utils";
import { parseTeacherActivationForm } from "../lib/teachers/validation";

test("plain text input removes markup, embedded script content, comments and invisible controls", () => {
  assert.equal(sanitizeInputText(" <b>maria</b>\0\t luz<!-- private -->\u200b "), "maria luz");
  assert.equal(sanitizeInputText("North<script>alert('unsafe')</script><style>body{}</style>Town"), "North Town");
  assert.equal(sanitizeInputText("Student<iframe>hidden <b>content</b></iframe> Record"), "Student Record");
  assert.equal(sanitizeInputText("Visible<script>unclosed unsafe text"), "Visible");
  assert.equal(sanitizeInputText("<img src=x onerror=alert(1)>"), "");
  assert.equal(sanitizeInputText("ma\u200bria\u202E"), "maria");
  assert.equal(sanitizeInputText("''; DROP TABLE students; --"), "''; DROP TABLE students; --");
  for (const value of [null, undefined, 12, {}, ["name"]]) assert.equal(sanitizeInputText(value), "");
});

test("nullable optional input recognizes only the whole N/A marker after sanitation", () => {
  for (const value of ["N/A", "N/a", "n/a", "n/A", "  N/a  ", "<b>n/a</b>", "N/\u200bA", "", "   ", null, undefined]) {
    assert.equal(nullableInputText(value), null);
  }
  for (const value of ["Jr.", "Sr.", "II", "III", "N/A Jr.", "NA", "N / A", "McDonald", "idAb12", "https://example.test/Name"]) {
    assert.equal(nullableInputText(` ${value} `), value);
  }
});

test("capitalization supports Unicode names, compound words, acronyms and existing name casing", () => {
  assert.equal(capitalizeInputText(" n\u0303ino  de la cruz "), "Ñino De La Cruz");
  assert.equal(capitalizeInputText("anne-marie o'neill (IT) McDonald"), "Anne-Marie O'Neill (IT) McDonald");
  assert.equal(capitalizeInputText("information technology & BSIT"), "Information Technology & BSIT");
  assert.equal(capitalizeInputText("<b>quezon</b>\n city"), "Quezon City");
  const normalized = capitalizeInputText("central\t school (IT) O'Neill");
  assert.equal(capitalizeInputText(normalized), normalized);
});

test("malformed repetitive markup is processed as plain text without leaving angle brackets", () => {
  assert.equal(sanitizeInputText("<script>".repeat(10_000) + "hidden"), "");
  assert.equal(sanitizeInputText("<".repeat(40_000) + " student "), "student");
});

test("teacher account setup preserves raw passwords and tokens while shared email normalization remains lowercase", () => {
  const form = new FormData();
  const password = " <Strong123!> ";
  form.set("token", "signed.payload.signature");
  form.set("password", password);
  form.set("confirmPassword", password);
  const parsed = parseTeacherActivationForm(form);
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail("Teacher password setup was rejected");
  assert.equal(parsed.password, password);
  assert.equal(normalizeEmail(" <b>Teacher.Name+Portal@Example.COM</b>\u200b "), "teacher.name+portal@example.com");
  const token = " signed.payload.signature ";
  form.set("token", token);
  assert.equal(readFormValue(form, "token"), token);
});
