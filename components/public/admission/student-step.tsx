"use client";

import { SelectField, TextField } from "./form-fields";
import { civilStatusOptions, genderOptions } from "./config";

export type StudentFieldName =
  | "student_first_name"
  | "student_last_name"
  | "student_middle_name"
  | "student_suffix"
  | "student_birth_date"
  | "student_gender"
  | "student_civil_status"
  | "student_citizenship"
  | "student_birthplace"
  | "student_religion";

type StudentFormValues = Record<StudentFieldName, string>;

type StudentStepProps = {
  form: StudentFormValues;
  onChange: (field: StudentFieldName, value: string) => void;
};

export default function StudentStep({ form, onChange }: StudentStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">
          Student information
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Enter the applicant&apos;s legal and personal details exactly as they
          appear on school and government records.
        </p>
      </div>

      <section className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            id="student_first_name"
            label="First name"
            value={form.student_first_name}
            onChange={onChange}
            autoComplete="given-name"
            required
          />
          <TextField
            id="student_last_name"
            label="Last name"
            value={form.student_last_name}
            onChange={onChange}
            autoComplete="family-name"
            required
          />
          <TextField
            id="student_middle_name"
            label="Middle name"
            value={form.student_middle_name}
            onChange={onChange}
            autoComplete="additional-name"
          />
          <TextField
            id="student_suffix"
            label="Suffix"
            value={form.student_suffix}
            onChange={onChange}
            placeholder="Example: Jr, III"
          />
          <TextField
            id="student_birth_date"
            label="Birth date"
            type="date"
            value={form.student_birth_date}
            onChange={onChange}
            autoComplete="bday"
            required
          />
          <SelectField
            id="student_gender"
            label="Gender"
            value={form.student_gender}
            onChange={onChange}
            placeholder="Select gender"
            required
          >
            {genderOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
          <SelectField
            id="student_civil_status"
            label="Civil status"
            value={form.student_civil_status}
            onChange={onChange}
            placeholder="Select civil status"
            required
          >
            {civilStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectField>
          <TextField
            id="student_citizenship"
            label="Citizenship"
            value={form.student_citizenship}
            onChange={onChange}
            placeholder="Example: Filipino"
            required
          />
          <TextField
            id="student_birthplace"
            label="Birthplace"
            value={form.student_birthplace}
            onChange={onChange}
            placeholder="City / Province / Country"
            required
          />
          <TextField
            id="student_religion"
            label="Religion"
            value={form.student_religion}
            onChange={onChange}
          />
        </div>
      </section>
    </div>
  );
}
