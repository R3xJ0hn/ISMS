import assert from "node:assert/strict";
import { test } from "node:test";
import { generateSchoolYears } from "../lib/utils";
import { validateSchoolYear } from "../lib/validation";

test("school year defaults include history and next year's period in descending order", () => {
  const years = generateSchoolYears({ referenceDate: new Date("2026-10-12T00:00:00Z") });
  assert.equal(years[0], "2027-2028");
  assert.equal(years.at(-1), "1900-1901");
  assert.equal(years.length, 128);
  assert.equal(new Set(years).size, years.length);
  assert.ok(years.every(validateSchoolYear));
  assert.ok(years.every((value, index) => value === `${2027 - index}-${2028 - index}`));
});

test("school year defaults advance at midnight in Manila rather than UTC", () => {
  const before = generateSchoolYears({ referenceDate: new Date("2026-12-31T15:59:59Z") });
  const after = generateSchoolYears({ referenceDate: new Date("2026-12-31T16:00:00Z") });
  assert.equal(before[0], "2027-2028");
  assert.equal(after[0], "2028-2029");
  assert.equal(after.length, before.length + 1);
});

test("school year ranges accept explicit inclusive limits and the validator's boundary years", () => {
  assert.deepEqual(generateSchoolYears({ startYear: 2020, endYear: 2022 }), [
    "2022-2023", "2021-2022", "2020-2021",
  ]);
  assert.deepEqual(generateSchoolYears({ startYear: 1900, endYear: 1900 }), ["1900-1901"]);
  assert.deepEqual(generateSchoolYears({ startYear: 2100, endYear: 2100 }), ["2100-2101"]);
  assert.equal(validateSchoolYear("2100-2101"), true);
});

test("school year defaults recompute for later reference dates and stop at the supported upper bound", () => {
  assert.equal(generateSchoolYears({ referenceDate: new Date("2037-06-01T00:00:00Z") })[0], "2038-2039");
  assert.equal(generateSchoolYears({ referenceDate: new Date("2042-06-01T00:00:00Z") })[0], "2043-2044");
  assert.equal(generateSchoolYears({ referenceDate: new Date("2110-06-01T00:00:00Z") })[0], "2100-2101");
});

test("invalid school year limits and unusable reference dates throw range errors", () => {
  for (const value of [1899, 2101, 2020.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, 9007199254740992]) {
    assert.throws(() => generateSchoolYears({ startYear: value, endYear: 2027 }), RangeError, `start: ${value}`);
    assert.throws(() => generateSchoolYears({ startYear: 1900, endYear: value }), RangeError, `end: ${value}`);
  }
  assert.throws(() => generateSchoolYears({ startYear: 2027, endYear: 2026 }), RangeError);
  assert.throws(() => generateSchoolYears({ referenceDate: new Date("invalid") }), RangeError);
});

test("school year options preserve existing legacy values exactly once without changing validators", () => {
  const range = { startYear: 2025, endYear: 2027 };
  const regular = generateSchoolYears({ ...range, selectedValue: "2026-2027" });
  assert.deepEqual(regular, ["2027-2028", "2026-2027", "2025-2026"]);

  for (const selectedValue of ["1999", "2010-2011", "2026 - 2027", " 2026-2027 ", "2140-2141", "Legacy period"]) {
    const years = generateSchoolYears({ ...range, selectedValue });
    assert.deepEqual(years.slice(0, -1), regular);
    assert.equal(years.at(-1), selectedValue);
    assert.equal(years.filter((value) => value === selectedValue).length, 1);
  }
  assert.equal(validateSchoolYear("2140-2141"), false);
  assert.equal(validateSchoolYear("Legacy period"), false);
});

test("blank selected values add no options and generated arrays remain independent", () => {
  const range = { startYear: 2026, endYear: 2027 };
  for (const selectedValue of [undefined, null, "", " ", "\t\n"]) {
    assert.deepEqual(generateSchoolYears({ ...range, selectedValue }), ["2027-2028", "2026-2027"]);
  }
  const first = generateSchoolYears(range);
  first.push("Changed locally");
  assert.deepEqual(generateSchoolYears(range), ["2027-2028", "2026-2027"]);
});
