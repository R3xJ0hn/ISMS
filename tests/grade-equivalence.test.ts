import assert from "node:assert/strict";
import { test } from "node:test";

import { getGradeEquivalent, GRADE_SCALE } from "../lib/grade-equivalence";

test("the published scale retains the provided equivalents and deliberately blank descriptions", () => {
  assert.deepEqual(GRADE_SCALE.map(({ equivalent, range, description }) => [equivalent, range, description]), [
    ["1.00", "98% - 100%", "Excellent"],
    ["1.25", "95% - 97%", "Very Good"],
    ["1.50", "92% - 94%", null],
    ["1.75", "89% - 91%", null],
    ["2.00", "86% - 88%", "Good"],
    ["2.25", "83% - 85%", null],
    ["2.50", "80% - 82%", "Satisfactory"],
    ["2.75", "76% - 79%", "Fair"],
    ["3.00", "75%", "Passed"],
    ["5.00", "Below 75%", "Failed"],
    ["INC", "Incomplete", null],
  ]);
});

test("every whole percentage maps to exactly the supplied scale", () => {
  for (let average = 0; average <= 100; average += 1) {
    const expected = average >= 98 ? ["1.00", "Excellent"]
      : average >= 95 ? ["1.25", "Very Good"]
      : average >= 92 ? ["1.50", null]
      : average >= 89 ? ["1.75", null]
      : average >= 86 ? ["2.00", "Good"]
      : average >= 83 ? ["2.25", null]
      : average >= 80 ? ["2.50", "Satisfactory"]
      : average >= 76 ? ["2.75", "Fair"]
      : average === 75 ? ["3.00", "Passed"]
      : ["5.00", "Failed"];
    assert.deepEqual(getGradeEquivalent(String(average)), {
      equivalent: expected[0], description: expected[1],
      status: average >= 75 ? "passed" : "failed", average, roundedAverage: average,
    }, `Average ${average}`);
  }
});

test("decimal averages round first at every cutoff and retain the recorded percentage", () => {
  const cutoffs = [
    [74.5, "3.00", "5.00"],
    [75.5, "2.75", "3.00"],
    [79.5, "2.50", "2.75"],
    [82.5, "2.25", "2.50"],
    [85.5, "2.00", "2.25"],
    [88.5, "1.75", "2.00"],
    [91.5, "1.50", "1.75"],
    [94.5, "1.25", "1.50"],
    [97.5, "1.00", "1.25"],
  ] as const;
  for (const [cutoff, roundedUp, roundedDown] of cutoffs) {
    const atCutoff = getGradeEquivalent(String(cutoff));
    assert.equal(atCutoff.equivalent, roundedUp, String(cutoff));
    assert.equal(atCutoff.average, cutoff);
    assert.equal(atCutoff.roundedAverage, Math.ceil(cutoff));
    assert.equal(getGradeEquivalent(String(cutoff - 0.001)).equivalent, roundedDown);
  }
  assert.deepEqual(getGradeEquivalent("97.5%"), {
    equivalent: "1.00", description: "Excellent", status: "passed", average: 97.5, roundedAverage: 98,
  });
  assert.equal(getGradeEquivalent("74.5").status, "passed");
});

test("valid decimal percentage formatting preserves zero and the full-precision source average", () => {
  for (const input of ["0", "0.0", "00", " 0% ", "\t0.00 %\n"]) {
    assert.deepEqual(getGradeEquivalent(input), {
      equivalent: "5.00", description: "Failed", status: "failed", average: 0, roundedAverage: 0,
    });
  }
  assert.equal(getGradeEquivalent("100.00 %").equivalent, "1.00");
  assert.equal(getGradeEquivalent("  82.4321 %  ").average, 82.4321);
});

test("missing, nonnumeric, nonfinite and out-of-range averages never fabricate an equivalent", () => {
  const invalid = [
    null, "", " ", "N/A", "NaN", "Infinity", "-Infinity", "-0", "-1", "100.001", "101",
    "1e2", "0x64", "97.5 points", "97.5/100", "97%%", "9 7", "1,000", "97.", ".5",
    "=97.5", "<script>alert(97)</script>", "97% Passed", "9\u00007", "9\n7",
  ];
  for (const input of invalid) {
    assert.deepEqual(getGradeEquivalent(input, "Passed"), {
      equivalent: null, description: null, status: "unavailable", average: null, roundedAverage: null,
    }, String(input));
  }
  assert.equal(getGradeEquivalent("9999999999999999999999999999999999999999999").status, "unavailable");
  assert.equal(getGradeEquivalent(null, "Average 98").status, "unavailable");
  assert.equal(getGradeEquivalent(null, "98").status, "unavailable");
});

test("only whole incomplete markers resolve INC in the average or remarks", () => {
  for (const marker of ["INC", "inc", " InC. ", "Incomplete", "\tincomplete\n"]) {
    assert.deepEqual(getGradeEquivalent(marker), {
      equivalent: "INC", description: null, status: "incomplete", average: null, roundedAverage: null,
    });
    assert.equal(getGradeEquivalent(null, marker).equivalent, "INC");
  }
  for (const remarks of ["Incomplete requirements", "INC / Passed", "Not incomplete", "INCIDENT", "Incomplete."]) {
    assert.equal(getGradeEquivalent(null, remarks).status, "unavailable", remarks);
    assert.equal(getGradeEquivalent("98", remarks).equivalent, "1.00", remarks);
  }
});

test("explicit incomplete remarks override a numeric equivalent without erasing the source average", () => {
  assert.deepEqual(getGradeEquivalent("97.5 %", "INC."), {
    equivalent: "INC", description: null, status: "incomplete", average: 97.5, roundedAverage: 98,
  });
  assert.equal(getGradeEquivalent("INC", "Passed").status, "incomplete");
  assert.equal(getGradeEquivalent("0", "Failed").equivalent, "5.00");
  assert.equal(getGradeEquivalent("98", "Failed").equivalent, "1.00");
});
