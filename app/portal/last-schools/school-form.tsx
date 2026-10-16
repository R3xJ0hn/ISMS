"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BadgeCheck, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import { SchoolType } from "@/lib/generated/prisma/enums";
import type { LastSchoolFormRecord, LastSchoolFormState } from "@/lib/last-schools/types";
import { capitalizeInputText, sanitizeInputText } from "@/lib/utils";
import { AdmissionSelect } from "../admission/admission-ui";
import { saveLastSchoolAction } from "./actions";

type Props = { mode: "create" } | { mode: "edit"; school: LastSchoolFormRecord };
type FieldName = "schoolName" | "shortName" | "street" | "barangay" | "city" | "province" | "postalCode";
const fields: { name: FieldName; label: string; required?: boolean; maxLength: number; wide?: boolean }[] = [
  { name: "schoolName", label: "School name", required: true, maxLength: 255, wide: true },
  { name: "shortName", label: "Short name", maxLength: 80 },
  { name: "street", label: "Street", maxLength: 160, wide: true },
  { name: "barangay", label: "Barangay", required: true, maxLength: 120 },
  { name: "city", label: "City / Municipality", required: true, maxLength: 120 },
  { name: "province", label: "Province", required: true, maxLength: 120 },
  { name: "postalCode", label: "Postal code", maxLength: 20 },
];
const initialState: LastSchoolFormState = { success: false, message: "" };
function normalizeField(name: FieldName, value: string) {
  return name === "postalCode" ? sanitizeInputText(value) : capitalizeInputText(value);
}

export function LastSchoolForm(props: Props) {
  const creating = props.mode === "create";
  const [values, setValues] = useState(() => {
    const school = props.mode === "edit" ? props.school : null;
    return Object.fromEntries(fields.map(({ name }) => [name, normalizeField(name, school?.[name] ?? "")])) as Record<FieldName, string>;
  });
  const [schoolType, setSchoolType] = useState<string>(props.mode === "edit" ? props.school.schoolType : "");
  const [state, formAction, pending] = useActionState(saveLastSchoolAction, initialState);
  const disabled = pending || state.success;
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/last-schools", refresh: true });
  const mayVerify = props.mode === "edit" && props.school.verificationStatus !== "verified";
  const typeError = state.fieldErrors?.schoolType;

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="w-full max-w-4xl space-y-6">
      {props.mode === "edit" && <input type="hidden" name="schoolId" value={props.school.id} />}
      <fieldset disabled={disabled} className="grid min-w-0 gap-5 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5 md:grid-cols-2">
        <legend className="px-2 text-base font-semibold">School details</legend>
        {fields.map((field) => {
          const id = `last-school-${field.name}`;
          const error = state.fieldErrors?.[field.name];
          return (
            <div key={field.name} className={`min-w-0 space-y-2${field.wide ? " md:col-span-2" : ""}`}>
              <label htmlFor={id} className="block text-sm font-medium">{field.label}{field.required && <span className="text-destructive"> *</span>}</label>
              <Input id={id} name={field.name} value={values[field.name]} required={field.required} maxLength={field.maxLength}
                autoCapitalize={field.name === "postalCode" ? "none" : "words"} autoComplete="off"
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                onBlur={(event) => { const normalized = normalizeField(field.name, event.currentTarget.value); setValues((current) => ({ ...current, [field.name]: normalized })); }}
                aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
              {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
            </div>
          );
        })}
        <div className="min-w-0 space-y-2 md:col-start-2 md:row-start-2">
          <label htmlFor="last-school-type" className="block text-sm font-medium">School type<span className="text-destructive"> *</span></label>
          <AdmissionSelect id="last-school-type" name="schoolType" required value={schoolType}
            onChange={(event) => setSchoolType(event.target.value)} aria-invalid={Boolean(typeError)} aria-describedby={typeError ? "last-school-type-error" : undefined}>
            <option value="" disabled>Select school type</option>
            {Object.values(SchoolType).map((type) => <option key={type} value={type}>{type}</option>)}
          </AdmissionSelect>
          {typeError && <p id="last-school-type-error" className="text-sm text-destructive">{typeError}</p>}
        </div>
        <p className="text-sm text-muted-foreground md:col-span-2">
          {creating ? "Schools added here are verified and become available in the student school list." : mayVerify ?
            "Corrections update this school for all students whose admissions are linked to it. Save changes to keep its current review status, or save and verify to include it in the student school list." :
            "Corrections update this verified school for all students whose admissions are linked to it."}
        </p>
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline"><Link href="/portal/last-schools">Cancel</Link></Button>
        {!creating && <Button type="submit" name="intent" value="save" variant={mayVerify ? "outline" : "default"} disabled={disabled}>
          <Save aria-hidden="true" />{pending ? "Saving..." : "Save changes"}
        </Button>}
        {(creating || mayVerify) && <Button type="submit" name="intent" value="verify" disabled={disabled}>
          {creating ? <Plus aria-hidden="true" /> : <BadgeCheck aria-hidden="true" />}
          {pending ? "Saving..." : creating ? "Add verified school" : "Save and verify"}
        </Button>}
      </div>
    </form>
  );
}
