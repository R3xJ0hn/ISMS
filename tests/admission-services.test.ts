import assert from "node:assert/strict";
import test from "node:test";

import {
  firstInvalidStudentUpdateField, normalizeStudentUpdateInput, studentProfileFromSubmission,
  studentUpdateFields, type UpdateStudentRecordInput,
} from "../lib/admission/student-fields";
import {
  addressDataFromProfile, guardianDataFromProfile, lastSchoolDataFromProfile, studentDataFromProfile,
} from "../lib/admission/profile-data";
import { readFormFields } from "../lib/admission/validation";
import { studentProfileFromRecord, type StudentUpdateQueryResult } from "../lib/admission/records";

function studentFixture(): UpdateStudentRecordInput {
  return {
    ...Object.fromEntries(studentUpdateFields.map((field) => [field, ""])),
    firstName: "Maria", lastName: "Santos", birthDate: "2008-02-29", email: "maria@example.com",
    addressBarangay: "Central", addressCity: "Manila", addressProvince: "Metro Manila",
    guardianFirstName: "Ana", guardianLastName: "Santos", guardianRelationship: "Mother",
    guardianContactNumber: "09171234567", lastSchoolName: "Central School", lastSchoolType: "Public",
    lastSchoolBarangay: "West", lastSchoolCity: "Quezon City", lastSchoolProvince: "Metro Manila",
    lastSchoolYear: "2025-2026", lastSchoolYearLevel: "Grade 12",
  } as UpdateStudentRecordInput;
}

test("student updates trim known fields and preserve missing nullable values as null", () => {
  const input = { ...studentFixture(), firstName: " Maria ", gender: " ", phone: undefined, unknown: "discard" };
  const normalized = normalizeStudentUpdateInput(input);
  assert.equal(normalized.firstName, "Maria");
  for (const field of ["gender", "civilStatus", "citizenship", "birthplace", "phone"] as const) {
    assert.equal(normalized[field], null);
  }
  assert.equal(normalized.middleName, "");
  assert.equal("unknown" in normalized, false);
  assert.equal(input.firstName, " Maria ");
});

test("student update validation preserves required-field precedence and nullable profile rules", () => {
  const input = normalizeStudentUpdateInput(studentFixture());
  assert.equal(firstInvalidStudentUpdateField(input), null);
  assert.equal(firstInvalidStudentUpdateField({ ...input, email: "", firstName: "" }), "firstName");
  assert.equal(firstInvalidStudentUpdateField({ ...input, birthDate: "2007-02-29", email: "bad" }), "birthDate");
  assert.equal(firstInvalidStudentUpdateField({ ...input, gender: "female" }), "gender");
  assert.equal(firstInvalidStudentUpdateField({ ...input, civilStatus: "invalid" }), "civilStatus");
  assert.equal(firstInvalidStudentUpdateField({ ...input, email: "bad" }), "email");
  assert.equal(firstInvalidStudentUpdateField({ ...input, phone: "123" }), "phone");
  assert.equal(firstInvalidStudentUpdateField({ ...input, guardianContactNumber: "123" }), "guardianContactNumber");
  assert.equal(firstInvalidStudentUpdateField({ ...input, lastSchoolType: "public" }), "lastSchoolType");
  // Secure profile updates currently require school-year text but do not impose the application format.
  assert.equal(firstInvalidStudentUpdateField({ ...input, lastSchoolYear: "2025 to 2026" }), null);
});

test("profile writes retain optional nulls, contact values, and distinct student and school addresses", () => {
  const profile = normalizeStudentUpdateInput(studentFixture());
  const birthDate = new Date("2008-02-29T00:00:00Z");
  const student = studentDataFromProfile(profile, birthDate);
  assert.equal(student.birthDate, birthDate);
  assert.equal(student.email, "maria@example.com");
  assert.equal(student.citizenship, null);
  assert.equal(student.phone, null);
  assert.equal(student.gender, null);
  assert.equal(student.middleName, null);
  assert.equal(guardianDataFromProfile(profile).contactNumber, "09171234567");
  assert.equal(guardianDataFromProfile(profile).occupation, null);
  assert.equal(lastSchoolDataFromProfile(profile).schoolId, null);
  assert.equal(addressDataFromProfile(profile, "address").city, "Manila");
  assert.equal(addressDataFromProfile(profile, "lastSchool").city, "Quezon City");
  assert.equal(addressDataFromProfile(profile, "lastSchool").postalCode, null);
});

test("application field mapping distinguishes student, guardian and school IDs and names", () => {
  const profile = studentProfileFromSubmission({
    student_first_name: "Maria", guardian_first_name: "Ana", contact_email: "maria@example.com",
    last_school_id: "123456", current_student_record_id: "9007199254740993", student_number: "ignored",
  });
  assert.equal(profile.firstName, "Maria");
  assert.equal(profile.guardianFirstName, "Ana");
  assert.equal(profile.lastSchoolId, "123456");
  assert.equal(profile.email, "maria@example.com");
  assert.equal("current_student_record_id" in profile, false);
  assert.equal("studentNumber" in profile, false);
});

test("reading profile form fields ignores files and unlisted inputs", () => {
  const form = new FormData();
  form.set("firstName", " Maria ");
  form.set("lastName", new Blob(["data"]), "name.txt");
  form.set("studentId", "123");
  const profile = readFormFields(form, studentUpdateFields);
  assert.equal(profile.firstName, "Maria");
  assert.equal(profile.lastName, "");
  assert.equal(profile.middleName, "");
  assert.equal("studentId" in profile, false);
});

function savedStudentFixture(): StudentUpdateQueryResult {
  return {
    id: 9007199254740993n, firstName: "Maria", lastName: "Santos", middleName: null, suffix: null,
    birthDate: new Date("2008-02-29T00:00:00Z"), gender: null, civilStatus: null, citizenship: null,
    birthplace: null, religion: null, email: "maria@example.com", phone: null, facebookAccount: null,
    address: null, guardians: [], applications: [], enrollments: [],
  };
}

test("saved profiles preserve nullable values and tolerate missing school and guardian history", () => {
  const profile = studentProfileFromRecord(savedStudentFixture());
  assert.equal(profile.birthDate, "2008-02-29");
  for (const field of ["gender", "civilStatus", "citizenship", "birthplace", "phone"] as const) {
    assert.equal(profile[field], null);
  }
  assert.equal(profile.addressCity, "");
  assert.equal(profile.guardianFirstName, "");
  assert.equal(profile.lastSchoolYear, "");
  assert.equal(profile.lastSchoolGraduationDate, "");
});

test("saved profiles use the explicitly selected guardian for secure updates", () => {
  const student = savedStudentFixture();
  const guardian = {
    firstName: "Ana", lastName: "Santos", middleName: null, suffix: null,
    contactNumber: "09171234567", occupation: null,
  };
  student.guardians = [
    { relationship: "Aunt", isPrimary: false, guardian: { ...guardian, firstName: "Luz" } },
    { relationship: "Mother", isPrimary: true, guardian },
  ];
  const profile = studentProfileFromRecord(student, undefined, student.guardians[1]);
  assert.equal(profile.guardianFirstName, "Ana");
  assert.equal(profile.guardianRelationship, "Mother");
});
