"use client";

import Link from "next/link";
import { useActionState, useState, type FocusEvent } from "react";

import { FormFields, TextField, type FormFieldDefinition } from "@/app/(public)/admission/components/form-fields";
import { LastSchoolStep, type LastSchoolFieldName, type LastSchoolFormValues } from "@/app/(public)/admission/components/last-school-step";
import { studentUpdateSections } from "@/app/(public)/admission/components/form-schema";
import { Button } from "@/components/ui/button";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import { normalizeStudentField, studentSubmissionFields, studentUpdateFields, type StudentUpdateField } from "@/lib/admission/student-fields";
import type { StudentAdmissionReviewRecord, StudentAdmissionReviewState } from "@/lib/admission/student-review";
import { saveStudentAdmissionReviewAction } from "./actions";

const initialState: StudentAdmissionReviewState = { success: false, message: "" };
const readonlyFields = new Set<string>(["email", "lastSchoolId", "lastSchoolHouseNumber", "lastSchoolSubdivision"]);
const profileFields: ReadonlySet<string> = new Set(studentUpdateFields);
const submissionFields = new Map<string, StudentUpdateField>(studentUpdateFields.map((field) => [studentSubmissionFields[field], field]));
const schoolFields = studentUpdateFields.filter((field) => field.startsWith("lastSchool") && !readonlyFields.has(field));
const sections = studentUpdateSections.map((section) => ({
  ...section,
  fields: section.fields.filter((field) => profileFields.has(field.id) && !readonlyFields.has(field.id)) as FormFieldDefinition<StudentUpdateField>[],
}));
const fieldLabels = new Map(sections.flatMap((section) => section.fields.map((field) => [field.id, field.label] as const)));

export default function StudentAdmissionReviewForm({ student }: { student: StudentAdmissionReviewRecord }) {
  const [state, action, pending] = useActionState(saveStudentAdmissionReviewAction, initialState);
  const [profile, setProfile] = useState<Record<StudentUpdateField, string>>(() => Object.fromEntries(
    studentUpdateFields.map((field) => [field, normalizeStudentField(field, student.profile[field])]),
  ) as Record<StudentUpdateField, string>);
  const [selectedSchoolId, setSelectedSchoolId] = useState(student.lastSchoolRecordId ?? "");
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/classroom", refresh: true });
  const schoolForm = {
    ...Object.fromEntries(studentUpdateFields.map((field) => [studentSubmissionFields[field], profile[field]])),
    last_school_record_id: selectedSchoolId,
  } as LastSchoolFormValues;

  function changeField(field: StudentUpdateField, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function normalizeField(event: FocusEvent<HTMLElement>) {
    const control = event.target as HTMLInputElement | HTMLSelectElement;
    const field = profileFields.has(control.name) ? control.name as StudentUpdateField : submissionFields.get(control.name);
    if (!field || readonlyFields.has(field)) return;
    changeField(field, normalizeStudentField(field, control.value));
  }

  function changeSchoolField(field: LastSchoolFieldName, value: string) {
    if (field === "last_school_record_id") {
      setSelectedSchoolId(value);
      return;
    }
    const profileField = submissionFields.get(field);
    if (profileField) changeField(profileField, value);
  }

  function errorAnchor(field: string) {
    if (field === "lastSchoolRecordId" || (selectedSchoolId && field === "lastSchoolName")) return "last-school-search";
    return schoolFields.includes(field as StudentUpdateField) ? studentSubmissionFields[field as StudentUpdateField] : field;
  }

  const errors = state.success ? [] : Object.entries(state.fieldErrors ?? {});
  const locked = pending || state.success;

  return (
    <form ref={formRef} action={action} onBlurCapture={normalizeField} className="min-w-0 space-y-6" aria-busy={pending}>
      <input type="hidden" name="applicationId" value={student.applicationId} />
      <input type="hidden" name="lastSchoolRecordId" value={selectedSchoolId} />
      {schoolFields.map((field) => <input key={field} type="hidden" name={field} value={profile[field]} />)}
      {errors.length ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-medium">Please check the following details:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {errors.map(([field, message]) => (
              <li key={field}><a className="underline underline-offset-2" href={`#${errorAnchor(field)}`}>{fieldLabels.get(field as StudentUpdateField) ?? "Student information"}: {message}</a></li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset disabled={locked} className="min-w-0 space-y-6">
        <legend className="sr-only">Your student information</legend>
        {sections.map((section) => (
          <section key={section.title} aria-labelledby={`review-${section.title.replaceAll(" ", "-").toLowerCase()}`} className="min-w-0 rounded-xl border bg-white p-5 shadow-sm sm:p-6">
            <h2 id={`review-${section.title.replaceAll(" ", "-").toLowerCase()}`} className={section.title === "Last school attended" ? "sr-only" : "mb-5 font-semibold"}>{section.title}</h2>
            {section.title === "Contact details" ? (
              <div className="mb-5">
                <TextField id="email" label="Email" type="email" value={profile.email} readOnly hint="Contact the registrar if your login email needs to change." />
              </div>
            ) : null}
            {section.title === "Last school attended" ? <LastSchoolStep form={schoolForm} onChange={changeSchoolField} /> : <FormFields fields={section.fields} values={profile} onChange={changeField} />}
          </section>
        ))}

        <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="text-sm leading-6 text-muted-foreground">Saving updates keeps your admission under review.</p>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link href="/portal/classroom" aria-disabled={locked || undefined} tabIndex={locked ? -1 : undefined}
              onClick={(event) => { if (locked) event.preventDefault(); }}
              className="inline-flex min-h-11 items-center justify-center rounded-md border px-4 text-sm font-medium transition hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50">
              Continue to classes
            </Link>
            <Button type="submit" disabled={locked} className="min-h-11">{pending ? "Saving..." : "Save and continue"}</Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
