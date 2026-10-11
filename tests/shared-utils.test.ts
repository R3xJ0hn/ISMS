import assert from "node:assert/strict";
import { test } from "node:test";
import { getPasswordValidationError, parseDateInput, validateEmail, validatePhone, validateSchoolYear } from "../lib/validation";
import { readFormFields, readFormText, readFormValue, formatDateInput, parseDateRange, formatAddress, parseId, normalizeEmail, parsePositiveSafeInteger, enumIncludes, hasValue, stringifyNullable, isRecord, normalizeHeader, normalizeKey, sanitizeText } from "../lib/utils";



test("date validation preserves UTC dates and rejects impossible calendar days", () => {
  assert.equal(parseDateInput("2024-02-29")?.toISOString(), "2024-02-29T00:00:00.000Z");
  for (const input of ["2023-02-29", "2026-04-31", "2026-13-01", "2026-01-00", "2026-1-01", "garbage"]) {
    assert.equal(parseDateInput(input), null, input);
  }
});

test("IDs retain database precision and reject nonnumeric input", () => {
  assert.equal(parseId("9007199254740993"), 9007199254740993n);
  for (const input of ["", "-1", "1.5", "1e3", " 1", "1x"]) assert.equal(parseId(input), null);
});

test("contact and school year rules accept real formats and reject invalid values", () => {
  assert.equal(validateEmail(" student@example.com "), true);
  assert.equal(validateEmail("student@"), false);
  assert.equal(validatePhone("+63 917 123 4567"), true);
  assert.equal(validatePhone("123456"), false);
  assert.equal(validatePhone("1234567890123456"), false);
  assert.equal(validateSchoolYear("2025 - 2026"), true);
  assert.equal(validateSchoolYear("2025"), true);
  assert.equal(validateSchoolYear("2025-2027"), false);
});

test("form reading ignores uploaded files and trims text", () => {
  const form = new FormData();
  form.set("name", " Student ");
  form.set("file", new Blob(["content"]), "students.csv");
  assert.equal(readFormText(form, "name"), "Student");
  assert.equal(readFormText(form, "file"), "");
  assert.equal(readFormText(form, "missing"), "");
});

test("raw form reading preserves passwords, first values and explicitly selected fields", () => {
  const form = new FormData();
  form.append("password", " Strong123! ");
  form.append("password", "ignored second value");
  form.set("name", " Student ");
  form.set("upload", new Blob(["text"]), "input.txt");
  form.set("extra", "excluded");

  assert.equal(readFormValue(form, "password"), " Strong123! ");
  assert.equal(readFormValue(form, "upload"), "");
  assert.deepEqual(readFormFields(form, ["name", "missing", "upload"]), {
    name: "Student", missing: "", upload: "",
  });
  assert.deepEqual(readFormFields(form, ["password", "name"], { trim: false }), {
    password: " Strong123! ", name: " Student ",
  });
});

test("password validation retains error precedence and the existing strength rules", () => {
  assert.equal(getPasswordValidationError("", ""), "Password and confirmation are required.");
  assert.equal(getPasswordValidationError("short", "other"), "Password must be at least 8 characters.");
  const strengthError = "Password must include uppercase and lowercase letters, a number, and a special character.";
  for (const value of ["lowercase1!", "UPPERCASE1!", "NoNumbers!", "NoSymbols1"]) {
    assert.equal(getPasswordValidationError(value, value), strengthError);
  }
  assert.equal(getPasswordValidationError("Strong123!", "Other123!"), "Passwords do not match.");
  assert.equal(getPasswordValidationError("Strong123!", "Strong123!"), null);
});

test("password validation keeps whitespace significant", () => {
  assert.equal(getPasswordValidationError(" Strong123! ", " Strong123! "), null);
  assert.equal(getPasswordValidationError("Strong123! ", "Strong123!"), "Passwords do not match.");
});

test("shared formatting preserves UTC date inputs and branch address order", () => {
  assert.equal(formatDateInput(new Date("2026-04-01T23:30:00-08:00")), "2026-04-02");
  assert.equal(formatAddress(null), "");
  assert.equal(formatAddress({
    houseNumber: "12", street: "Main Street", subdivision: "North Village", barangay: "Central",
    city: "Manila", province: "Metro Manila", postalCode: null,
  }), "12, Main Street, North Village, Central, Manila, Metro Manila");
});

test("email normalization trims and folds case while preserving local-part punctuation", () => {
  assert.equal(normalizeEmail(" Student@Example.COM "), "student@example.com");
  assert.equal(normalizeEmail("\tJane.Doe+Portal@Example.COM\n"), "jane.doe+portal@example.com");
  assert.equal(normalizeEmail("   "), "");
});

test("safe positive integers stay distinct from arbitrary-precision database IDs", () => {
  assert.equal(parseId("0"), 0n);
  assert.equal(parsePositiveSafeInteger("0012"), 12);
  assert.equal(parsePositiveSafeInteger(String(Number.MAX_SAFE_INTEGER)), Number.MAX_SAFE_INTEGER);
  for (const value of ["", "0", "-1", "1.5", "1e3", " 12", "12x", "9007199254740993"]) {
    assert.equal(parsePositiveSafeInteger(value), null, value);
  }
  assert.equal(enumIncludes({ Male: "Male", Female: "Female" }, "Female"), true);
  assert.equal(enumIncludes({ Male: "Male", Female: "Female" }, "female"), false);
});

test("value helpers retain zero, false, whitespace and array records", () => {
  for (const value of [null, undefined, ""]) assert.equal(hasValue(value), false);
  for (const value of [0, false, " "]) assert.equal(hasValue(value), true);
  assert.equal(stringifyNullable(0), "0");
  assert.equal(stringifyNullable(false), "false");
  assert.equal(stringifyNullable("  grade  "), "grade");
  assert.equal(stringifyNullable(" \t "), null);
  assert.equal(stringifyNullable(null), null);
  for (const value of [{}, [], new Date()]) assert.equal(isRecord(value), true);
  for (const value of [null, 0, false, "value"]) assert.equal(isRecord(value), false);
});

test("header and alias normalization keep their distinct punctuation rules", () => {
  assert.equal(normalizeHeader(" Student's E-mail "), "studentsemail");
  assert.equal(normalizeHeader(123), "123");
  assert.equal(normalizeHeader(null), "");
  assert.equal(normalizeKey(" Subject_Code-Title "), "subjectcodetitle");
  assert.equal(normalizeKey("Student's E-mail"), "student'semail");
  assert.equal(sanitizeText("\u0000Hello\r\nworld\u007F "), "Hello  world");
});

test("date ranges use UTC midnight and an exclusive next day across month/year boundaries", () => {
  const leapDay = parseDateRange("2024-02-29");
  assert.equal(leapDay?.start.toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(leapDay?.end.toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal(parseDateRange("2026-12-31")?.end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(parseDateRange("2023-02-29"), null);
});

