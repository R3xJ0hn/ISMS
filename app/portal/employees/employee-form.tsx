"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import { ProfileImageField } from "@/components/portal/profile-image-field";
import { CivilStatus, EmployeeStatus, Gender } from "@/lib/generated/prisma/enums";
import { employeeRoleOptions } from "@/lib/employees/roles";
import { employeeTextLimits, emptyEmployeeFormValues, type EmployeeFormState, type EmployeeFormValues } from "@/lib/employees/validation";
import { cn } from "@/lib/utils";
import { createEmployeeAction, updateEmployeeAction } from "./actions";

type EmployeeFormProps = { mode: "create" } | {
  mode: "edit";
  employeeRecordId: string;
  values: EmployeeFormValues;
  userImage?: string | null;
};

type EmployeeField = {
  name: keyof EmployeeFormValues;
  label: string;
  type?: "date" | "email" | "tel";
  choices?: ReadonlyArray<{ value: string; label: string }>;
  optional?: boolean;
  textarea?: boolean;
};

const choices = (values: Record<string, string>) => Object.values(values).map((value) => ({ value, label: value }));
const sections: Array<{ title: string; fields: EmployeeField[] }> = [
  { title: "Personal details", fields: [
    { name: "employeeId", label: "Employee ID" },
    { name: "lastName", label: "Last name" },
    { name: "firstName", label: "First name" },
    { name: "middleName", label: "Middle name", optional: true },
    { name: "suffix", label: "Suffix", optional: true },
    { name: "birthDate", label: "Date of birth", type: "date" },
    { name: "placeOfBirth", label: "Place of birth" },
    { name: "gender", label: "Gender", choices: choices(Gender) },
    { name: "civilStatus", label: "Civil status", choices: choices(CivilStatus) },
    { name: "nationality", label: "Nationality" },
  ] },
  { title: "Contact details", fields: [
    { name: "address", label: "Address", textarea: true },
    { name: "contactNumber", label: "Contact number", type: "tel" },
    { name: "emailAddress", label: "Email address", type: "email" },
  ] },
  { title: "Employment", fields: [
    { name: "dateStarted", label: "Date started", type: "date" },
    { name: "role", label: "Role", choices: employeeRoleOptions },
    { name: "status", label: "Status", choices: choices(EmployeeStatus) },
  ] },
  { title: "Government identifiers", fields: [
    { name: "tin", label: "TIN", optional: true },
    { name: "sssNo", label: "SSS number", optional: true },
    { name: "philHealthNo", label: "PhilHealth number", optional: true },
    { name: "pagIbigNo", label: "Pag-IBIG number", optional: true },
  ] },
];

const initialState: EmployeeFormState = { success: false, message: "" };
const textLimits: Partial<Record<keyof EmployeeFormValues, number>> = employeeTextLimits;
const identifierFields = new Set<keyof EmployeeFormValues>(["employeeId", "tin", "sssNo", "philHealthNo", "pagIbigNo"]);
const selectClassName = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive";

function EmployeeFields({ initialValues, errors, disabled }: {
  initialValues: EmployeeFormValues;
  errors: EmployeeFormState["fieldErrors"];
  disabled: boolean;
}) {
  const [values, setValues] = useState(() => ({ ...initialValues }));
  function changeValue(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  }

  return sections.map((section) => (
    <fieldset key={section.title} disabled={disabled} className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm">
      <legend className="px-2 text-base font-semibold">{section.title}</legend>
      <div className="grid gap-5 md:grid-cols-2">
        {section.fields.map((field) => {
          const id = `employee-${field.name}`;
          const error = errors?.[field.name];
          const inputProps = {
            id, name: field.name, value: values[field.name], onChange: changeValue, required: !field.optional,
            "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined,
          };
          return (
            <div key={field.name} className={cn("space-y-2", field.textarea && "md:col-span-2")}>
              <label htmlFor={id} className="block text-sm font-medium">
                {field.label}{field.optional ? <span className="ml-1 text-xs text-muted-foreground">(optional)</span> : <span className="text-destructive"> *</span>}
              </label>
              {field.choices ? (
                <select {...inputProps} className={selectClassName}>
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {field.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              ) : field.textarea ? (
                <textarea {...inputProps} rows={3} maxLength={textLimits[field.name]} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive" />
              ) : (
                <Input {...inputProps} type={field.type ?? "text"} maxLength={textLimits[field.name]} autoComplete="off"
                  autoCapitalize={field.type === "email" || identifierFields.has(field.name) ? "none" : "words"}
                  spellCheck={field.type === "email" || identifierFields.has(field.name) ? false : undefined}
                />
              )}
              {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
            </div>
          );
        })}
      </div>
    </fieldset>
  ));
}

export function EmployeeForm(props: EmployeeFormProps) {
  const creating = props.mode === "create";
  const [state, formAction, pending] = useActionState(creating ? createEmployeeAction : updateEmployeeAction, initialState);
  const [photoValid, setPhotoValid] = useState(true);
  const disabled = pending || state.success;
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/employees", refresh: true });

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="w-full max-w-4xl space-y-6">
      {props.mode === "edit" && <input type="hidden" name="employeeRecordId" value={props.employeeRecordId} />}
      <ProfileImageField imageUrl={props.mode === "edit" ? props.userImage : null}
        displayName={props.mode === "edit" ? `${props.values.firstName} ${props.values.lastName}`.trim() : "Employee"}
        disabled={disabled} error={state.fieldErrors?.image} onValidityChange={setPhotoValid} />
      <EmployeeFields key={props.mode === "edit" ? JSON.stringify(props.values) : "new"}
        initialValues={props.mode === "edit" ? props.values : emptyEmployeeFormValues} errors={state.fieldErrors} disabled={disabled}
      />
      {state.fieldErrors?.employeeRecordId && <p id="employee-record-error" role="alert" className="text-sm text-destructive">{state.fieldErrors.employeeRecordId}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline"><Link href="/portal/employees">Cancel</Link></Button>
        <Button type="submit" disabled={disabled || !photoValid}>
          {creating ? <UserPlus aria-hidden="true" /> : <Save aria-hidden="true" />}
          {pending ? creating ? "Adding employee..." : "Saving..." : creating ? "Add employee" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
