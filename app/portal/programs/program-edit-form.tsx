"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import { ProgramType } from "@/lib/generated/prisma/enums";
import type { ProgramFormState, ProgramFormValues } from "@/lib/programs/validation";
import { cn, formatProgramType } from "@/lib/utils";
import { updateProgramAction } from "./actions";

type Field = {
  name: keyof ProgramFormValues;
  label: string;
  required?: boolean;
  help?: string;
  multiline?: boolean;
  wide?: boolean;
  numeric?: boolean;
  choices?: Array<{ value: string; label: string }>;
};

const initialState: ProgramFormState = { success: false, message: "" };

export function ProgramEditForm({ programId, values: initialValues, groups }: {
  programId: string;
  values: ProgramFormValues;
  groups: Array<{ id: string; title: string }>;
}) {
  const [values, setValues] = useState(initialValues);
  const [state, formAction, pending] = useActionState(updateProgramAction, initialState);
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/programs" });

  function renderField(field: Field) {
    const id = `program-${field.name}`;
    const error = state.fieldErrors?.[field.name];
    const props = {
      id, name: field.name, value: values[field.name], required: field.required,
      "aria-invalid": Boolean(error),
      "aria-describedby": [field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValues((current) => ({ ...current, [field.name]: event.target.value }));
      },
    };
    return (
      <div key={field.name} className={cn("space-y-2", field.wide && "md:col-span-2")}>
        <label htmlFor={id} className="block text-sm font-medium">
          {field.label}{field.required && <span className="text-destructive"> *</span>}
        </label>
        {field.choices ? (
          <select {...props} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive">
            {field.choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
          </select>
        ) : field.multiline ? (
          <textarea {...props} rows={field.wide ? 5 : 6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive" />
        ) : <Input {...props} type={field.numeric ? "number" : "text"} min={field.numeric ? 0 : undefined} max={field.numeric ? 2147483647 : undefined} step={field.numeric ? 1 : undefined} />}
        {field.help && <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{field.help}</p>}
        {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  function renderSection(title: string, description: string, fields: Field[]) {
    return (
      <fieldset disabled={pending || state.success} className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm">
        <legend className="px-2 text-base font-semibold">{title}</legend>
        <p className="mb-5 text-sm text-muted-foreground">{description}</p>
        <div className="grid gap-5 md:grid-cols-2">{fields.map(renderField)}</div>
      </fieldset>
    );
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="w-full space-y-6">
      <input type="hidden" name="programId" value={programId} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          {renderSection("Admission information", "These names and codes appear in admission choices and student records.", [
            { name: "label", label: "Program name", required: true },
            { name: "code", label: "Program code", required: true },
            { name: "programType", label: "Program type", required: true, choices: Object.values(ProgramType).map((value) => ({ value, label: formatProgramType(value) })) },
          ])}
          {renderSection("Course details", "Enter one topic or pathway per line. Empty lines are ignored.", [
            { name: "focusAreas", label: "Topics to explore", multiline: true },
            { name: "pathways", label: "Career and study pathways", multiline: true },
          ])}
        </div>
        {renderSection("Public course page", "Choose a category and fill in the course URL, public title, public code, and overview to show this program on the website.", [
          { name: "groupId", label: "Category", choices: [{ value: "", label: "Not listed publicly" }, ...groups.map((group) => ({ value: group.id, label: group.title }))] },
          { name: "sortOrder", label: "Display order", required: true, numeric: true, help: "Lower numbers appear first within a category." },
          { name: "publicTitle", label: "Public title" },
          { name: "publicCode", label: "Public code" },
          { name: "slug", label: "Course URL", help: "For example: information-technology becomes /programs/information-technology." },
          { name: "note", label: "Program note" },
          { name: "overview", label: "Overview", multiline: true, wide: true },
        ])}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline"><Link href="/portal/programs">Back to programs</Link></Button>
        <Button type="submit" disabled={pending || state.success}><Save className="size-4" />{pending ? "Saving..." : "Save changes"}</Button>
      </div>
    </form>
  );
}
