import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FormFields, type FormFieldDefinition } from "../app/(public)/admission/components/form-fields";
import { detailsSteps, studentUpdateSections } from "../app/(public)/admission/components/form-schema";
import { DetailsStep } from "../app/(public)/admission/components/form-sections";
import { initialFormValues } from "../app/(public)/admission/components/wizard-state";

test("public admission renders a required school-year dropdown with a selection placeholder", () => {
  const field = detailsSteps.lastSchool.sections.flatMap((section) => section.fields).find(({ id }) => id === "last_school_year");
  assert.ok(field);
  assert.equal(typeof field.options, "function");

  const markup = renderToStaticMarkup(createElement(DetailsStep, {
    stepId: "lastSchool", form: initialFormValues, onChange: () => {},
  }));
  const select = markup.match(/<select[^>]*id="last_school_year"[^>]*>[\s\S]*?<\/select>/)?.[0];
  assert.ok(select);
  assert.match(select, /name="last_school_year"/);
  assert.match(select, /required=""/);
  assert.match(select, /aria-required="true"/);
  assert.match(select, /<option value=""[^>]*selected=""[^>]*>Select school year<\/option>/);
  assert.match(select, /<option value="1900-1901">1900-1901<\/option>/);
  assert.doesNotMatch(markup, /<input[^>]*id="last_school_year"/);
  assert.match(markup, /<input[^>]*id="last_school_year_level"[^>]*type="text"/);
});

function secureSchoolYearField(): FormFieldDefinition<"lastSchoolYear"> {
  const field = studentUpdateSections.flatMap((section) => section.fields).find(({ id }) => id === "lastSchoolYear");
  assert.ok(field);
  assert.equal(typeof field.options, "function");
  assert.equal(field.required, true);
  assert.equal(field.placeholder, "Select school year");
  return { ...field, id: "lastSchoolYear" };
}

test("secure student-update school-year dropdown preserves saved single, spaced, custom and older years", () => {
  const field = secureSchoolYearField();
  for (const selectedValue of ["2025", "2025 - 2026", "2025 to 2026", "1899-1900"]) {
    const markup = renderToStaticMarkup(createElement(FormFields<"lastSchoolYear">, {
      fields: [field], values: { lastSchoolYear: selectedValue },
    }));
    assert.match(markup, /<select[^>]*id="lastSchoolYear"[^>]*name="lastSchoolYear"[^>]*required=""/);
    assert.ok(markup.includes(`<option value="${selectedValue}" selected="">${selectedValue}</option>`));
    assert.equal((markup.match(/selected=""/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /<input[^>]*id="lastSchoolYear"/);
  }
});

test("secure student-update school year remains unselected until the user chooses a value", () => {
  const markup = renderToStaticMarkup(createElement(FormFields<"lastSchoolYear">, {
    fields: [secureSchoolYearField()], values: { lastSchoolYear: "" },
  }));
  assert.match(markup, /<option value="" disabled="" selected="">Select school year<\/option>/);
  assert.equal((markup.match(/selected=""/g) ?? []).length, 1);
});

test("dynamic field options are resolved during render using controlled or default values", () => {
  const receivedValues: string[] = [];
  const fields: FormFieldDefinition<"year">[] = [{
    id: "year", label: "School year", options: (selectedValue) => {
      receivedValues.push(selectedValue);
      return [selectedValue || "2026-2027"];
    },
  }];
  assert.deepEqual(receivedValues, []);
  renderToStaticMarkup(createElement(FormFields<"year">, { fields, values: { year: "2024-2025" }, onChange: () => {} }));
  renderToStaticMarkup(createElement(FormFields<"year">, { fields, values: { year: "2025 to 2026" } }));
  renderToStaticMarkup(createElement(FormFields<"year">, { fields, values: { year: null } }));
  assert.deepEqual(receivedValues, ["2024-2025", "2025 to 2026", ""]);
});
