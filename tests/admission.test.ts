import assert from "node:assert/strict";
import { test } from "node:test";

import { serializeAdmittedStudent, type AdmittedStudentQueryResult } from "../lib/admission/records";
import { parseDateInput, parseId, readFormText, validateEmail, validatePhone, validateSchoolYear } from "../lib/admission/validation";

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

function applicationFixture(): AdmittedStudentQueryResult {
  return {
    id: 9007199254740993n, studentId: 2n, branchId: 3n, programId: 4n, academicLevelsId: 5n,
    lastSchoolId: null, applicantType: "new", programType: "Bachelor", applicationStatus: "submitted",
    remarks: null, submittedAt: new Date("2026-10-10T00:00:00Z"),
    createdAt: new Date("2026-10-10T00:00:00Z"), updatedAt: new Date("2026-10-10T00:00:00Z"),
    LSSchoolYearEnd: null, LSAttainedLevelText: null, LSGraduationDate: null,
    branch: { slug: "main", title: "Main Campus" },
    program: { code: "BSIT", label: "Information Technology", programType: "Bachelor" },
    academicLevels: { label: "First Year" }, lastSchool: null,
    student: {
      id: 2n, studentNumber: null, firstName: "Maria", lastName: "Santos", middleName: null, suffix: null,
      birthDate: new Date("2008-02-29T00:00:00Z"), gender: "Female", civilStatus: null,
      citizenship: null, birthplace: null, religion: null, email: "maria@example.com", phone: null,
      facebookAccount: null, address: null, guardians: [],
    },
  };
}

test("admission records serialize optional relations and bigint IDs for client forms", () => {
  const record = serializeAdmittedStudent(applicationFixture());
  assert.equal(record.applicationId, "9007199254740993");
  assert.equal(record.birthDate, "2008-02-29");
  assert.equal(record.guardianFirstName, "");
  assert.equal(record.addressBarangay, "");
  assert.equal(record.lastSchoolName, "");
  assert.equal(record.reviewForm.program_label, "Information Technology");
  assert.doesNotThrow(() => JSON.stringify(record));
});

test("saved guardian, address and school details reach both edit and review forms", () => {
  const fixture = applicationFixture();
  fixture.student.address = {
    houseNumber: "10", subdivision: null, street: "Main", barangay: "Central",
    city: "Manila", province: "Metro Manila", postalCode: "1000",
  };
  fixture.student.guardians = [{
    relationship: "Mother",
    guardian: { firstName: "Ana", lastName: "Santos", middleName: null, suffix: null, contactNumber: "09171234567", occupation: null },
  }];
  fixture.lastSchool = { schoolName: "Central School", schoolId: "123", shortName: null, schoolType: "Public", address: fixture.student.address };
  fixture.LSGraduationDate = new Date("2026-04-01T00:00:00Z");
  const record = serializeAdmittedStudent(fixture);
  assert.equal(record.guardianRelationship, record.reviewForm.guardian_relationship);
  assert.equal(record.guardianFirstName, "Ana");
  assert.equal(record.addressBarangay, record.reviewForm.address_barangay);
  assert.equal(record.lastSchoolId, record.reviewForm.last_school_id);
  assert.equal(record.lastSchoolGraduationDate, "2026-04-01");
});
