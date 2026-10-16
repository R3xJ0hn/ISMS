import assert from "node:assert/strict";
import test from "node:test";
import { parseSubjectForm, parseSubjectId } from "../lib/subjects/validation";

function form(values: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ subjectId: "9007199254740993", name: " <b>computer</b>\t programming ", code: " <i>cs_100</i> ", units: "3", ...values })) result.set(key, value);
  return result;
}

test("subjects save sanitized human names and preserve identifier case and punctuation", () => {
  const result = parseSubjectForm(form({ password: "injected", programId: "777" }), "edit");
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Valid subject rejected");
  assert.equal(result.id, 9007199254740993n);
  assert.deepEqual(result.data, { name: "Computer Programming", code: "cs_100", units: "3" });
  const withoutCode = parseSubjectForm(form({ code: "<b> </b>" }), "create");
  assert.equal(withoutCode.success, false);
  if (!withoutCode.success) assert.ok(withoutCode.fieldErrors.code);
});

test("subject units preserve zero and fractional values and reject unsafe decimal representations", () => {
  for (const units of ["0", "0.00", "1.5", "3", "99.99"]) {
    const result = parseSubjectForm(form({ units }), "create");
    assert.equal(result.success, true, units);
    if (!result.success) assert.fail("Valid units rejected");
    assert.equal(result.data.units, units);
  }
  for (const units of ["", "-1", "100", "1.234", "1e1", "NaN", "Infinity", "<b>3</b>"]) {
    const result = parseSubjectForm(form({ units }), "create");
    assert.equal(result.success, false, units);
    if (!result.success) assert.ok(result.fieldErrors.units);
  }
});

test("subject IDs reject unsafe route values and retain the entire signed bigint range", () => {
  assert.equal(parseSubjectId("9223372036854775807"), 9223372036854775807n);
  for (const subjectId of ["", "0", "-1", "1.1", "1e2", "1x", "9223372036854775808", "<b>1</b>"]) {
    assert.equal(parseSubjectId(subjectId), null, subjectId);
    const result = parseSubjectForm(form({ subjectId }), "edit");
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors.subjectId);
  }
});

test("subjects reject empty sanitized names and bound database text after normalization", () => {
  const invalidValues: Record<string, string>[] = [{ name: "<script>private content</script>" }, { name: "x".repeat(201) }, { code: "x".repeat(51) }];
  for (const values of invalidValues) {
    const result = parseSubjectForm(form(values), "create");
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.fieldErrors["name" in values ? "name" : "code"]);
  }
  assert.equal(parseSubjectForm(form({ name: "x".repeat(200), code: "x".repeat(50) }), "create").success, true);
});
