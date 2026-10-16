import assert from "node:assert/strict";
import test from "node:test";
import { EmployeeRole, EmployeeStatus } from "../lib/generated/prisma/enums";
import {
  employeeFields, employeeTextLimits, emptyEmployeeFormValues, parseEmployeeForm, parseEmployeeRecordId,
  type EmployeeFormValues,
} from "../lib/employees/validation";
import { getEmployeeFullName } from "../lib/employees/names";

const referenceDate = new Date("2026-10-13T00:00:00Z");
const input: EmployeeFormValues = {
  employeeId: "emp-000a", firstName: "maria", lastName: "McDonald", middleName: "", suffix: "",
  birthDate: "1990-02-28", placeOfBirth: "quezon city",
  gender: "Female", civilStatus: "Single", nationality: "filipino", address: "main street, quezon city",
  contactNumber: "09171234567", emailAddress: "maria@example.com", tin: "001-123", sssNo: "",
  philHealthNo: "000100", pagIbigNo: "00a-09", dateStarted: "2020-03-01", role: "teacher", status: "Regular",
};

function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [field, value] of Object.entries({ ...input, employeeRecordId: "9007199254740993", ...overrides })) result.set(field, value);
  return result;
}

test("employee parsing sanitizes and capitalizes human text while preserving identifier formats", () => {
  const data = form({
    employeeId: " <b>emp-000a</b> ", firstName: "<b>maria</b>\t elena", lastName: "<i>McDonald</i>",
    middleName: "<b>de la cruz</b>", suffix: " jr. ", placeOfBirth: "quezon\n city",
    nationality: "filipino", address: "<i>main street</i>,\r\n quezon city", emailAddress: " MARIA@Example.COM ",
    tin: " 001-123 ", sssNo: "<script>ignored()</script>", password: "Should not be read", userId: "77", fullName: "Ignored full name",
  });
  const result = parseEmployeeForm(data, "edit", referenceDate);
  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.id, 9007199254740993n);
  assert.equal(result.data.employeeId, "emp-000a");
  assert.equal(result.data.firstName, "Maria Elena");
  assert.equal(result.data.lastName, "McDonald");
  assert.equal(result.data.middleName, "De La Cruz");
  assert.equal(result.data.suffix, "Jr.");
  assert.equal(result.data.placeOfBirth, "Quezon City");
  assert.equal(result.data.address, "Main Street , Quezon City");
  assert.equal(result.data.nationality, "Filipino");
  assert.equal(result.data.emailAddress, "maria@example.com");
  assert.equal(result.data.contactNumber, "09171234567");
  assert.equal(result.data.tin, "001-123");
  assert.equal(result.data.sssNo, null);
  assert.equal(result.data.philHealthNo, "000100");
  assert.equal(result.data.pagIbigNo, "00a-09");
  assert.equal(result.data.birthDate.toISOString(), "1990-02-28T00:00:00.000Z");
  assert.equal(result.data.dateStarted.toISOString(), "2020-03-01T00:00:00.000Z");
  assert.deepEqual(Object.keys(result.data), [...employeeFields]);
  assert.equal("employeeRecordId" in result.data || "password" in result.data || "userId" in result.data || "fullName" in result.data, false);
});

test("all required employee fields are checked after sanitation; middle name, suffix and government identifiers remain optional", () => {
  const result = parseEmployeeForm(new FormData(), "create", referenceDate);
  assert.equal(result.success, false);
  if (result.success) return;
  for (const field of employeeFields) {
    assert.equal(Boolean(result.fieldErrors?.[field]), !["middleName", "suffix", "tin", "sssNo", "philHealthNo", "pagIbigNo"].includes(field), field);
  }
  for (const field of ["firstName", "lastName"] as const) {
    const markup = parseEmployeeForm(form({ [field]: "<br>" }), "create", referenceDate);
    assert.equal(markup.success, false);
    if (!markup.success) assert.ok(markup.fieldErrors?.[field]);
    assert.equal(emptyEmployeeFormValues[field], "");
  }
  assert.equal(Object.keys(emptyEmployeeFormValues).length, 20);
  const optional = parseEmployeeForm(form({ middleName: "<br>", suffix: "   " }), "create", referenceDate);
  assert.equal(optional.success, true);
  if (optional.success) {
    assert.equal(optional.data.middleName, null);
    assert.equal(optional.data.suffix, null);
  }
});

test("employee create and edit save N/A suffixes as null while preserving real suffixes", () => {
  for (const mode of ["create", "edit"] as const) {
    for (const suffix of ["N/a", "n/a", "N/A", " n/A ", "<b>n/a</b>"]) {
      const result = parseEmployeeForm(form({ suffix }), mode, referenceDate);
      assert.equal(result.success, true, `${mode}/${suffix}`);
      if (result.success) assert.equal(result.data.suffix, null, `${mode}/${suffix}`);
    }
    for (const [suffix, expected] of [["jr.", "Jr."], [" Sr. ", "Sr."], ["III", "III"]]) {
      const result = parseEmployeeForm(form({ suffix }), mode, referenceDate);
      assert.equal(result.success, true, `${mode}/${suffix}`);
      if (result.success) assert.equal(result.data.suffix, expected, `${mode}/${suffix}`);
    }
  }
});

test("employee dates reject impossible values, future births and start dates before birth", () => {
  for (const [field, value] of [["birthDate", "1990-02-29"], ["birthDate", "2026-10-14"],
    ["dateStarted", "2025-02-29"], ["dateStarted", "1989-12-31"]] as const) {
    const result = parseEmployeeForm(form({ [field]: value }), "create", referenceDate);
    assert.equal(result.success, false, `${field}/${value}`);
    if (!result.success) assert.ok(result.fieldErrors?.[field]);
  }
  assert.equal(parseEmployeeForm(form({ dateStarted: "2099-01-01" }), "create", referenceDate).success, true);
  assert.equal(parseEmployeeForm(form({ birthDate: "2000-02-29", dateStarted: "2000-02-29" }), "create", referenceDate).success, true);
});

test("future-birth validation uses the Manila calendar date at the UTC date boundary", () => {
  const result = parseEmployeeForm(form({ birthDate: "2026-10-13", dateStarted: "2026-10-13" }), "create", new Date("2026-10-12T16:00:00Z"));
  assert.equal(result.success, true);
});

test("employee enum values must be exact and allow only employee roles including non-teaching", () => {
  for (const role of Object.values(EmployeeRole)) {
    const result = parseEmployeeForm(form({ role }), "create", referenceDate);
    assert.equal(result.success, true, role);
    if (result.success) assert.equal(result.data.role, role);
  }
  for (const status of Object.values(EmployeeStatus)) {
    const result = parseEmployeeForm(form({ status }), "create", referenceDate);
    assert.equal(result.success, true, status);
    if (result.success) assert.equal(result.data.status, status);
  }
  for (const [field, value] of [["role", "Teacher"], ["role", "student"], ["role", "superAdmin"], ["role", "non-teaching"], ["status", "regular"], ["gender", "female"], ["civilStatus", "single"]] as const) {
    const result = parseEmployeeForm(form({ [field]: value }), "create", referenceDate);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors?.[field]);
  }
});

test("employee fields enforce maximum lengths and email/contact formats", () => {
  for (const [field, maximum] of Object.entries(employeeTextLimits)) {
    const result = parseEmployeeForm(form({ [field]: "x".repeat(maximum + 1) }), "create", referenceDate);
    assert.equal(result.success, false, field);
    if (!result.success) assert.ok(result.fieldErrors?.[field as keyof EmployeeFormValues]);
  }
  for (const [field, value] of [["emailAddress", "not-an-address"], ["contactNumber", "123"]] as const) {
    const result = parseEmployeeForm(form({ [field]: value }), "create", referenceDate);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors?.[field]);
  }
});

test("employee record IDs are separate from business IDs and retain PostgreSQL bigint precision", () => {
  for (const id of ["0", "-1", "1.5", "1e2", "emp-000a", "9223372036854775808", "9".repeat(100)]) {
    assert.equal(parseEmployeeRecordId(id), null);
    const result = parseEmployeeForm(form({ employeeRecordId: id }), "edit", referenceDate);
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors?.employeeRecordId);
  }
  assert.equal(parseEmployeeRecordId("9223372036854775807"), 9223372036854775807n);
  assert.equal(parseEmployeeRecordId("9007199254740993"), 9007199254740993n);
  assert.equal(parseEmployeeForm(form({ employeeRecordId: "invalid" }), "create", referenceDate).success, true);
});

test("employee forms ignore files, unknown fields and account credentials", () => {
  const data = form({ passwordHash: "injected", emailVerified: "true", id: "7" });
  data.set("firstName", new Blob(["a name"]), "name.txt");
  const result = parseEmployeeForm(data, "create", referenceDate);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.fieldErrors?.firstName);
});

test("employee display names include optional name parts without introducing extra spaces", () => {
  assert.equal(getEmployeeFullName({ firstName: " Maria ", middleName: " De La Cruz ", lastName: " Santos ", suffix: " Jr. " }), "Maria De La Cruz Santos Jr.");
  assert.equal(getEmployeeFullName({ firstName: "Maria", lastName: "Santos", middleName: null, suffix: " " }), "Maria Santos");
  assert.equal(getEmployeeFullName({ firstName: null, lastName: null, middleName: null, suffix: null }), "Name not set");
  assert.equal(getEmployeeFullName({ firstName: " ", lastName: " " }), "Name not set");
});
