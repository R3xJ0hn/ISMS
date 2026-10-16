import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getSpreadsheetId, normalizeSpreadsheetUrl, parseClassForm, parseClassId, parseTeacherSpreadsheetForm,
} from "../lib/classes/validation";

function classForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [field, value] of Object.entries({
    classId: "9007199254740993", schoolYear: " 2026 - 2027 ", sectionName: " BSIT 1A ",
    yearLevel: "FirstYear", semester: "FirstSemester", teacherId: "9007199254740995", branchId: "9007199254740997", programId: "9007199254740999", subjectId: "9007199254741001", ...overrides,
  })) form.set(field, value);
  return form;
}

function spreadsheetForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [field, value] of Object.entries({
    classId: "9007199254740993",
    spreadsheetUrl: " https://docs.google.com/spreadsheets/d/sheet_123-Abc/edit?gid=9#gid=9 ", ...overrides,
  })) form.set(field, value);
  return form;
}

test("class roster submissions distinguish omitted, explicit empty, and precise saved student IDs", () => {
  const omitted = parseClassForm(classForm(), "edit");
  assert.equal(omitted.success, true);
  assert.equal("studentIds" in omitted, false);
  const empty = classForm(); empty.set("studentIds", "");
  const cleared = parseClassForm(empty, "edit");
  assert.equal(cleared.success, true);
  if (!cleared.success) assert.fail();
  assert.deepEqual(cleared.studentIds, []);
  const selected = classForm();
  selected.append("studentIds", ""); selected.append("studentIds", "9007199254740993"); selected.append("studentIds", "9007199254740993");
  const parsed = parseClassForm(selected, "create");
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail();
  assert.deepEqual(parsed.studentIds, [9007199254740993n]);
  assert.equal("studentIds" in parsed.data, false);
});

test("class rosters reject invalid IDs, file values, repeated empty markers, and over 1,000 entries", () => {
  for (const value of ["0", "-1", "bad", "9223372036854775808", new File(["1"], "student.txt")]) {
    const form = classForm(); form.append("studentIds", value);
    const result = parseClassForm(form, "create");
    assert.equal(result.success, false);
    if (result.success) assert.fail();
    assert.ok(result.fieldErrors?.studentIds);
  }
  for (const values of [["", ""], Array.from({ length: 1001 }, (_, index) => String(index + 1))]) {
    const form = classForm(); for (const value of values) form.append("studentIds", value);
    assert.equal(parseClassForm(form, "create").success, false);
  }
});

test("class creation needs no spreadsheet and ignores unlisted privileged inputs", () => {
  const parsed = parseClassForm(classForm({ role: "superAdmin", createdAt: "forged" }), "create");
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail("Valid class was rejected");
  assert.deepEqual(parsed.data, {
    schoolYear: "2026-2027", sectionName: "BSIT 1A", yearLevel: "FirstYear", semester: "FirstSemester",
    teacherId: 9007199254740995n, branchId: 9007199254740997n, programId: 9007199254740999n, subjectId: 9007199254741001n,
  });
  assert.equal("id" in parsed, false);
  assert.equal("role" in parsed.data, false);
  assert.equal("createdAt" in parsed.data, false);
  assert.equal("spreadsheetUrl" in parsed.data, false);
});

test("superadmin class forms ignore forged spreadsheet links on both creation and edits", () => {
  for (const mode of ["create", "edit"] as const) {
    for (const spreadsheetUrl of ["", "https://evil.test/", "https://docs.google.com/spreadsheets/d/forged/edit"]) {
      const parsed = parseClassForm(classForm({ spreadsheetUrl }), mode);
      assert.equal(parsed.success, true);
      if (!parsed.success) assert.fail("An ignored spreadsheet input affected assignment validation");
      assert.equal("spreadsheetUrl" in parsed.data, false);
    }
  }
});

test("class IDs remain precise and reject nonpositive or out-of-range Postgres bigints", () => {
  const parsed = parseClassForm(classForm(), "edit");
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail("Valid class edit was rejected");
  assert.equal(parsed.id, 9007199254740993n);
  assert.equal(parseClassId("9223372036854775807"), 9223372036854775807n);
  for (const value of ["", "0", "-1", "1.2", "1e2", "abc", "9223372036854775808"]) {
    assert.equal(parseClassId(value), null, value);
    for (const field of ["classId", "teacherId", "branchId", "programId", "subjectId"] as const) {
      const invalid = parseClassForm(classForm({ [field]: value }), "edit");
      assert.equal(invalid.success, false, `${field}: ${value}`);
      if (invalid.success) assert.fail("Invalid class identifier was accepted");
      assert.ok(invalid.fieldErrors?.[field]);
    }
  }
});

test("new and edited class assignments require branch, program and subject selections", () => {
  for (const mode of ["create", "edit"] as const) {
    for (const field of ["branchId", "programId", "subjectId"] as const) {
      const form = classForm(); form.delete(field);
      const parsed = parseClassForm(form, mode);
      assert.equal(parsed.success, false);
      if (parsed.success) assert.fail("Missing selection was accepted");
      assert.ok(parsed.fieldErrors?.[field]);
    }
  }
});

test("class school years reuse shared year bounds and consecutive-year validation", () => {
  for (const schoolYear of ["1900", "2100", "2026-2027", "2026 - 2027"]) {
    assert.equal(parseClassForm(classForm({ schoolYear }), "create").success, true, schoolYear);
  }
  for (const schoolYear of ["", "1899", "2101", "2026-2028", "2026-2025", "2026/2027", "abc"]) {
    const parsed = parseClassForm(classForm({ schoolYear }), "create");
    assert.equal(parsed.success, false, schoolYear);
    if (parsed.success) assert.fail("Invalid school year was accepted");
    assert.ok(parsed.fieldErrors?.schoolYear);
  }
});

test("class names and levels require text within sensible maximum lengths", () => {
  for (const [field, maximum] of [["sectionName", 150]] as const) {
    assert.equal(parseClassForm(classForm({ [field]: "a".repeat(maximum) }), "create").success, true);
    for (const value of [" ", "a".repeat(maximum + 1), "<b> </b>"]) {
      const parsed = parseClassForm(classForm({ [field]: value }), "create");
      assert.equal(parsed.success, false, field);
      if (parsed.success) assert.fail("Invalid class text was accepted");
      assert.ok(parsed.fieldErrors?.[field]);
    }
  }
});

test("class text is sanitized and capitalized before database write mapping", () => {
  for (const mode of ["create", "edit"] as const) {
    const parsed = parseClassForm(classForm({
      sectionName: " <b>BSIT</b>\u0000  alpha ",
      yearLevel: "FirstYear",
      subjectName: "<i>introduction</i> to\n computing & IT",
    }), mode);
    assert.equal(parsed.success, true);
    if (!parsed.success) assert.fail("Sanitized class text was rejected");
    assert.equal(parsed.data.sectionName, "BSIT Alpha");
    assert.equal(parsed.data.yearLevel, "FirstYear");
    assert.equal("subjectName" in parsed.data, false, "Subject names must come from the saved subject, never from the form");
    assert.equal(parsed.data.schoolYear, "2026-2027");
    assert.equal(parsed.data.teacherId, 9007199254740995n);
  }
});

test("class year levels accept only enum selections and reject IDs, labels and forged values", () => {
  for (const yearLevel of ["Grade11", "Grade12", "FirstYear", "SecondYear", "ThirdYear", "FourthYear"]) {
    const parsed = parseClassForm(classForm({ yearLevel }), "create");
    assert.equal(parsed.success, true, yearLevel);
    if (!parsed.success) assert.fail("An enum year level was rejected");
    assert.equal(parsed.data.yearLevel, yearLevel);
  }
  for (const yearLevel of ["", "3", "1st year", "First Year", "firstyear", "<b>FirstYear</b>", "Unknown"]) {
    const parsed = parseClassForm(classForm({ yearLevel }), "create");
    assert.equal(parsed.success, false, yearLevel);
    if (parsed.success) assert.fail("A forged year level was accepted");
    assert.ok(parsed.fieldErrors?.yearLevel);
  }
});

test("new and edited classes require a saved semester enum without guessing missing legacy values", () => {
  for (const mode of ["create", "edit"] as const) {
    for (const semester of ["FirstSemester", "SecondSemester"]) {
      const result = parseClassForm(classForm({ semester }), mode);
      assert.ok(result.success);
      assert.equal(result.data.semester, semester);
    }
    for (const semester of ["", "firstsemester", "First Semester", "1stSem", "ThirdSemester", "<b>FirstSemester</b>"]) {
      const result = parseClassForm(classForm({ semester }), mode);
      assert.equal(result.success, false, `${mode}: ${semester}`);
      if (result.success) assert.fail("An invalid semester was accepted");
      assert.ok(result.fieldErrors?.semester);
    }
    for (const file of [false, true]) {
      const form = classForm();
      if (file) form.set("semester", new File(["FirstSemester"], "semester.txt"));
      else form.delete("semester");
      const result = parseClassForm(form, mode);
      assert.equal(result.success, false);
      if (result.success) assert.fail("A missing or non-text semester was accepted");
      assert.ok(result.fieldErrors?.semester);
    }
    for (const semesters of [["FirstSemester", "SecondSemester"], ["FirstSemester", "FirstSemester"], ["", "FirstSemester"]]) {
      const form = classForm(); form.delete("semester");
      for (const semester of semesters) form.append("semester", semester);
      const result = parseClassForm(form, mode);
      assert.equal(result.success, false, "Duplicate semester fields must be rejected");
      if (result.success) assert.fail("Multiple semester fields were accepted");
      assert.ok(result.fieldErrors?.semester);
    }
  }
});

test("Google Sheets parsing preserves gid links and supports account-index paths", () => {
  for (const url of [
    "https://docs.google.com/spreadsheets/d/sheet_123-Abc",
    "https://docs.google.com/spreadsheets/d/sheet_123-Abc/edit?gid=99#gid=99",
    "https://docs.google.com/spreadsheets/u/0/d/sheet_123-Abc/edit",
    "https://docs.google.com/spreadsheets/u/12/d/sheet_123-Abc/preview",
    "https://docs.google.com/spreadsheets/d/sheet_123-Abc/export?format=csv",
  ]) {
    assert.equal(getSpreadsheetId(url), "sheet_123-Abc", url);
    assert.equal(parseTeacherSpreadsheetForm(spreadsheetForm({ spreadsheetUrl: url })).success, true, url);
  }
  assert.equal(
    normalizeSpreadsheetUrl(" HTTPS://DOCS.GOOGLE.COM/spreadsheets/d/sheet_123-Abc/edit?gid=99#gid=99 "),
    "https://docs.google.com/spreadsheets/d/sheet_123-Abc/edit?gid=99#gid=99",
  );
});

test("Google Sheets parsing rejects credentials, forged hosts, other protocols and non-spreadsheet paths", () => {
  for (const url of [
    "", "not a URL", "http://docs.google.com/spreadsheets/d/sheet/edit",
    "javascript:alert(1)", "https://example.com/spreadsheets/d/sheet/edit",
    "https://docs.google.com.evil.test/spreadsheets/d/sheet/edit",
    "https://docs.google.com@evil.test/spreadsheets/d/sheet/edit",
    "https://user:password@docs.google.com/spreadsheets/d/sheet/edit",
    "https://docs.google.com:8443/spreadsheets/d/sheet/edit",
    "https://docs.google.com/document/d/sheet/edit", "https://docs.google.com/spreadsheets/d/",
    "https://docs.google.com/spreadsheets/d/sheet/arbitrary-path",
    "https://docs.google.com/spreadsheets/d/sheet%2Fforged/edit",
    "https://docs.google.com/spreadsheets/d/sheet/../../document/d/other/edit",
    "https://docs.google.com/spreadsheets/d/sh\neet/edit",
    "https://docs.google.com/spreadsheets/d/sheet/edit?gid=\u200b9",
    "https://docs.google.com/spreadsheets/d/sheet/edit?gid=\u00859",
    "https://docs.google.com/spreadsheets/d/sheet/edit?long=" + "a".repeat(2048),
  ]) {
    assert.equal(getSpreadsheetId(url), null, url);
    assert.equal(normalizeSpreadsheetUrl(url), null, url);
    const parsed = parseTeacherSpreadsheetForm(spreadsheetForm({ spreadsheetUrl: url }));
    assert.equal(parsed.success, false, url);
    if (parsed.success) assert.fail("Unsafe spreadsheet URL was accepted");
    assert.ok(parsed.fieldErrors?.spreadsheetUrl);
  }
});

test("class forms safely reject file values in required fields", () => {
  for (const field of ["classId", "teacherId", "branchId", "programId", "subjectId", "sectionName"] as const) {
    const form = classForm();
    form.set(field, new Blob(["forged"]), "data.txt");
    const parsed = parseClassForm(form, "edit");
    assert.equal(parsed.success, false, field);
    if (parsed.success) assert.fail("Non-text class value was accepted");
    assert.ok(parsed.fieldErrors?.[field]);
  }
});

test("teacher spreadsheet forms preserve exact class IDs and normalized URLs without assignment fields", () => {
  const parsed = parseTeacherSpreadsheetForm(spreadsheetForm({ teacherId: "forged", subjectName: "forged" }));
  assert.equal(parsed.success, true);
  if (!parsed.success) assert.fail("Valid teacher spreadsheet submission was rejected");
  assert.deepEqual(parsed, {
    success: true, id: 9007199254740993n,
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123-Abc/edit?gid=9#gid=9",
  });
  for (const classId of ["", "0", "-1", "1x", "9223372036854775808"]) {
    const invalid = parseTeacherSpreadsheetForm(spreadsheetForm({ classId }));
    assert.equal(invalid.success, false, classId);
    if (invalid.success) assert.fail("Invalid teacher spreadsheet class ID was accepted");
    assert.ok(invalid.fieldErrors?.classId);
  }
});

test("teacher spreadsheet forms require a nonblank text link and text class ID", () => {
  const blank = parseTeacherSpreadsheetForm(spreadsheetForm({ spreadsheetUrl: " " }));
  assert.equal(blank.success, false);
  if (blank.success) assert.fail("Removing a teacher spreadsheet was accepted");
  assert.ok(blank.fieldErrors?.spreadsheetUrl);

  for (const field of ["classId", "spreadsheetUrl"] as const) {
    const form = spreadsheetForm();
    form.set(field, new Blob(["forged"]), "data.txt");
    const invalid = parseTeacherSpreadsheetForm(form);
    assert.equal(invalid.success, false, field);
    if (invalid.success) assert.fail("A file value was accepted in a teacher spreadsheet field");
    assert.ok(invalid.fieldErrors?.[field]);
  }
});
