import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentGradeSummary } from "../components/classroom/student-grade-summary";
import type { ClassSummaryStudent } from "../lib/classes/spreadsheet";
import { defaultClassPeriodVisibility, type ClassPeriodVisibility } from "../lib/classes/period-visibility";

function renderRecord(values: Partial<ClassSummaryStudent> = {}, visibility?: ClassPeriodVisibility) {
  return renderToStaticMarkup(React.createElement(StudentGradeSummary, {
    record: {
      studentNumber: "0007", studentName: "Ana Cruz", prelim: "89", midterm: "95", prefinals: "98", finals: "100",
      average: "97.5", remarks: "Passed", note: null, ...values,
    },
    visibility,
  }));
}

test("student grade result prioritizes the original final average and rounded equivalent before the period scores", () => {
  const markup = renderRecord();
  assert.match(markup, /aria-label="Final grade result"/);
  assert.match(markup, /Final average<\/dt>/);
  assert.match(markup, />97\.5<\/span><span[^>]*>%<\/span>/);
  assert.match(markup, /Grade equivalent<\/dt><dd[^>]*>1\.00<\/dd>/);
  assert.match(markup, /Excellent/);
  assert.match(markup, /Rounded to 98% for the grade equivalent\./);
  assert.ok(markup.indexOf("Final average") < markup.indexOf("Grading periods"));
  for (const period of ["Prelim", "Midterm", "Prefinals", "Finals"]) assert.match(markup, new RegExp(`>${period}</dt>`));
  assert.doesNotMatch(markup, /Student number|0007|Ana Cruz|progressbar|completion|chart/i);
});

test("failed and zero averages show their saved scores with a visible failure status", () => {
  for (const average of ["74", "0"]) {
    const markup = renderRecord({ average, remarks: "Failed", prelim: "0", finals: null });
    assert.match(markup, new RegExp(`>${average}</span><span[^>]*>%</span>`));
    assert.match(markup, /Grade equivalent<\/dt><dd[^>]*>5\.00<\/dd>/);
    assert.match(markup, />Failed<\/span>/);
    assert.match(markup, /Prelim<\/dt><dd[^>]*>0<\/dd>/);
    assert.match(markup, /Finals<\/dt><dd[^>]*>Not posted<\/dd>/);
    assert.doesNotMatch(markup, /Rounded to|>Incomplete<\/span>|>Passed<\/span>/);
  }
});

test("incomplete remarks retain the numeric average but replace the equivalent and rounding explanation", () => {
  const markup = renderRecord({ remarks: "INC." });
  assert.match(markup, />97\.5<\/span><span[^>]*>%<\/span>/);
  assert.match(markup, /Grade equivalent<\/dt><dd[^>]*>INC<\/dd>/);
  assert.match(markup, />Incomplete<\/span>/);
  assert.match(markup, /Your grade is marked incomplete\./);
  assert.match(markup, /Remarks<\/dt><dd[^>]*>INC\.<\/dd>/);
  assert.doesNotMatch(markup, /Rounded to|>Passed<\/span>/);
});

test("missing averages stay unavailable and do not fabricate a passing, failing or incomplete result", () => {
  const markup = renderRecord({ average: null, remarks: null, prelim: null, midterm: null, prefinals: null, finals: null });
  assert.match(markup, />Not available<\/span>/);
  assert.match(markup, /Grade equivalent<\/dt><dd[^>]*>—<\/dd>/);
  assert.match(markup, /valid final average is available/);
  assert.equal((markup.match(/>Not posted<\/dd>/g) ?? []).length, 4);
  assert.doesNotMatch(markup, /Rounded to|>Failed<\/span>|>Passed<\/span>|>Incomplete<\/span>/);
});

test("whole averages do not announce rounding and saved text is displayed as escaped text", () => {
  const markup = renderRecord({ average: "100%", remarks: '<script>alert("remarks")</script>', note: '<img src=x onerror="alert(1)">\nA long saved note' });
  assert.match(markup, />100<\/span><span[^>]*>%<\/span>/);
  assert.match(markup, /Grade equivalent<\/dt><dd[^>]*>1\.00<\/dd>/);
  assert.match(markup, /&lt;script&gt;alert\(&quot;remarks&quot;\)&lt;\/script&gt;/);
  assert.match(markup, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(markup, /A long saved note/);
  assert.doesNotMatch(markup, /Rounded to|<script>|<img/);
});

test("grading reference is collapsed by default and preserves all scale entries, including blank descriptions", () => {
  const markup = renderRecord({ average: "93", remarks: null });
  assert.match(markup, /<details\b/);
  assert.doesNotMatch(markup, /<details[^>]*\bopen(?:=|\s|>)/);
  assert.match(markup, />Grading scale<\/span>/);
  assert.match(markup, /nearest whole percent before conversion/);
  assert.equal((markup.match(/<th scope="row"/g) ?? []).length, 11);
  assert.match(markup, />1\.50<\/th><td[^>]*>92% - 94%<\/td><td[^>]*>—<\/td>/);
  assert.match(markup, />5\.00<\/th><td[^>]*>Below 75%<\/td><td[^>]*>Failed<\/td>/);
  assert.match(markup, />INC<\/th><td[^>]*>Incomplete<\/td><td[^>]*>—<\/td>/);
});

test("teacher-hidden periods have a clear label and suppress final results without masking released grades", () => {
  const markup = renderRecord({ prelim: "81.111", midterm: "82.222", prefinals: "83.333", finals: null, average: "88.888", remarks: "PRIVATE OVERALL REMARK", note: "PRIVATE OVERALL NOTE" }, { ...defaultClassPeriodVisibility, prelimVisible: false, prefinalsVisible: false });
  assert.match(markup, /aria-label="Final result not released"/);
  assert.match(markup, /teacher releases all grading periods/);
  assert.equal((markup.match(/>Hidden by your teacher<\/dd>/g) ?? []).length, 2);
  assert.match(markup, />82\.222<\/dd>/);
  assert.match(markup, /Finals<\/dt><dd[^>]*>Not posted<\/dd>/);
  assert.doesNotMatch(markup, /81\.111|83\.333|88\.888|PRIVATE OVERALL|aria-label="Final grade result"|Rounded to|Your grade is marked incomplete/);
});

test("unreleased final results remain hidden even if the source record still contains an incomplete status", () => {
  const markup = renderRecord({ average: "97.5", remarks: "INC", note: "PRIVATE HIDDEN NOTE" }, { ...defaultClassPeriodVisibility, finalsVisible: false });
  assert.match(markup, /Final result not released/);
  assert.match(markup, /Finals<\/dt><dd[^>]*>Hidden by your teacher<\/dd>/);
  assert.doesNotMatch(markup, /97\.5|PRIVATE HIDDEN NOTE|>Incomplete<\/span>|Grade equivalent<\/dt>|Remarks<\/dt>|Note<\/dt>/);
});
