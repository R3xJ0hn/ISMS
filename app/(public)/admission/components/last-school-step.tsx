"use client";

import { SelectField, TextField } from "./form-fields";
import { schoolTypeOptions } from "./config";
import type { LastSchoolStepProps } from "@/lib/types";

export default function LastSchoolStep({
  form,
  onChange,
}: LastSchoolStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">Previous school</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Provide the school most recently attended before this admission
          application. These details help the registrar review eligibility and
          admission requirements.
        </p>
      </div>

      <section className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            School details
          </h4>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="last_school_name"
            label="School name"
            value={form.last_school_name}
            onChange={onChange}
            required
          />
          <TextField
            id="last_school_short_name"
            label="Short name"
            value={form.last_school_short_name}
            onChange={onChange}
            placeholder="Optional"
          />
          <TextField
            id="last_school_id"
            label="School ID"
            value={form.last_school_id}
            onChange={onChange}
            placeholder="Optional"
          />
          <SelectField
            id="last_school_type"
            label="School type"
            value={form.last_school_type}
            onChange={onChange}
            placeholder="Select school type"
            required
          >
            {schoolTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            School address
          </h4>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="last_school_house_number"
            label="House number / unit"
            value={form.last_school_house_number}
            onChange={onChange}
          />
          <TextField
            id="last_school_subdivision"
            label="Subdivision / village"
            value={form.last_school_subdivision}
            onChange={onChange}
          />
          <TextField
            id="last_school_street"
            label="Street"
            value={form.last_school_street}
            onChange={onChange}
          />
          <TextField
            id="last_school_barangay"
            label="Barangay"
            value={form.last_school_barangay}
            onChange={onChange}
            required
          />
          <TextField
            id="last_school_city"
            label="City / municipality"
            value={form.last_school_city}
            onChange={onChange}
            required
          />
          <TextField
            id="last_school_province"
            label="Province"
            value={form.last_school_province}
            onChange={onChange}
            required
          />
          <TextField
            id="last_school_postal_code"
            label="Postal code"
            value={form.last_school_postal_code}
            onChange={onChange}
          />
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Academic details
          </h4>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="last_school_year"
            label="Last school year attended"
            value={form.last_school_year}
            onChange={onChange}
            placeholder="Example: 2025-2026"
            required
          />
          <TextField
            id="last_school_year_level"
            label="Year level completed"
            value={form.last_school_year_level}
            onChange={onChange}
            placeholder="Example: Grade 12 / First Year"
            required
          />
          <TextField
            id="last_school_graduation_date"
            label="Graduation date"
            type="date"
            value={form.last_school_graduation_date}
            onChange={onChange}
            hint="Leave blank if not yet graduated."
          />
        </div>
      </section>
    </div>
  );
}
