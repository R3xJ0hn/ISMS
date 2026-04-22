"use client";

import { TextField } from "./form-fields";

export type GuardianFieldName =
  | "guardian_last_name"
  | "guardian_first_name"
  | "guardian_middle_name"
  | "guardian_suffix"
  | "guardian_relationship"
  | "guardian_contact_number"
  | "guardian_occupation";

type GuardianFormValues = Record<GuardianFieldName, string>;

type GuardianStepProps = {
  form: GuardianFormValues;
  onChange: (field: GuardianFieldName, value: string) => void;
};

export default function GuardianStep({ form, onChange }: GuardianStepProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">
          Parent or guardian
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Enter the primary parent or guardian the school should contact for
          support, urgent matters, and admission follow-up.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          id="guardian_first_name"
          label="First name"
          value={form.guardian_first_name}
          onChange={onChange}
          autoComplete="given-name"
          required
        />
        <TextField
          id="guardian_last_name"
          label="Last name"
          value={form.guardian_last_name}
          onChange={onChange}
          autoComplete="family-name"
          required
        />
        <TextField
          id="guardian_middle_name"
          label="Middle name"
          value={form.guardian_middle_name}
          onChange={onChange}
          autoComplete="additional-name"
        />
        <TextField
          id="guardian_suffix"
          label="Suffix"
          value={form.guardian_suffix}
          onChange={onChange}
          placeholder="Optional"
        />
        <TextField
          id="guardian_relationship"
          label="Relationship to student"
          value={form.guardian_relationship}
          onChange={onChange}
          placeholder="Example: Mother, Father, Aunt"
          required
        />
        <TextField
          id="guardian_contact_number"
          label="Contact number"
          type="tel"
          value={form.guardian_contact_number}
          onChange={onChange}
          placeholder="09xx xxx xxxx"
          autoComplete="tel"
          required
        />
        <TextField
          id="guardian_occupation"
          label="Occupation"
          value={form.guardian_occupation}
          onChange={onChange}
          placeholder="Optional"
        />
      </div>
    </div>
  );
}
