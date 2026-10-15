"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import { subjectTextLimits, type SubjectFormState, type SubjectFormValues } from "@/lib/subjects/validation";
import { createSubjectAction, updateSubjectAction } from "./actions";

type SubjectFormProps = { mode: "create" } | { mode: "edit"; subjectId: string; values: SubjectFormValues };
const initialState: SubjectFormState = { success: false, message: "" };

export function SubjectForm(props: SubjectFormProps) {
  const creating = props.mode === "create";
  const [values, setValues] = useState(() => props.mode === "edit" ? { ...props.values } : { name: "", code: "", units: "" });
  const [state, formAction, pending] = useActionState(creating ? createSubjectAction : updateSubjectAction, initialState);
  const disabled = pending || state.success;
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/subjects", refresh: true });

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="w-full max-w-2xl space-y-6">
      {props.mode === "edit" && <input type="hidden" name="subjectId" value={props.subjectId} />}
      <fieldset disabled={disabled} className="space-y-5 rounded-lg border border-border bg-card p-5 shadow-sm">
        <legend className="px-2 text-base font-semibold">Subject details</legend>
        {([{ name: "name", label: "Subject name" }, { name: "code", label: "Subject code" }, { name: "units", label: "Units" }] as const).map((field) => {
          const id = `subject-${field.name}`;
          const error = state.fieldErrors?.[field.name];
          return <div key={field.name} className="space-y-2">
            <label htmlFor={id} className="block text-sm font-medium">{field.label}<span className="text-destructive"> *</span></label>
            <Input id={id} name={field.name} value={values[field.name]} required
              {...(field.name === "units" ? { type: "number", min: 0, max: 99.99, step: 0.01 } : { maxLength: subjectTextLimits[field.name] })}
              autoComplete="off" autoCapitalize={field.name === "name" ? "words" : "none"} spellCheck={field.name === "code" ? false : undefined}
              onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
          </div>;
        })}
        {props.mode === "edit" && <p className="text-sm text-muted-foreground">Changes to the subject name also appear in its linked classes.</p>}
      </fieldset>
      {state.fieldErrors?.subjectId && <p role="alert" className="text-sm text-destructive">{state.fieldErrors.subjectId}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button asChild variant="outline"><Link href="/portal/subjects">Cancel</Link></Button>
        <Button type="submit" disabled={disabled}>{creating ? <Plus aria-hidden="true" /> : <Save aria-hidden="true" />}{pending ? creating ? "Adding subject..." : "Saving..." : creating ? "Add subject" : "Save changes"}</Button>
      </div>
    </form>
  );
}
