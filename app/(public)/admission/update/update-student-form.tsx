"use client";

import * as React from "react";

import { updateStudentInformation, type UpdateStudentFormState } from "./actions";
import type { StudentUpdateRecord } from "@/lib/admission/student-update";
import { FormFields, TextField } from "../components/form-fields";
import { studentUpdateSections } from "../components/form-sections";

const initialState: UpdateStudentFormState = { status: "idle", message: "" };

const enrollmentFields = [
  { id: "latestEnrollmentStatus", label: "Enrollment status" },
  { id: "latestEnrollmentSchoolYear", label: "Latest school year" },
  { id: "latestEnrollmentBranch", label: "Branch" },
  { id: "latestEnrollmentProgram", label: "Program" },
  { id: "latestEnrollmentYearLevel", label: "Year level" },
  { id: "latestEnrollmentSection", label: "Section" },
] as const;

export default function UpdateStudentForm({ student }: { student: StudentUpdateRecord }) {
  const [state, formAction, pending] = React.useActionState(updateStudentInformation, initialState);

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <input type="hidden" name="token" value={student.token} />
      {(["lastSchoolHouseNumber", "lastSchoolSubdivision", "lastSchoolStreet"] as const).map((name) => (
        <input key={name} type="hidden" name={name} value={student[name]} />
      ))}

      <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">Student record update</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
          Update your saved student information
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Review the fields below and save any changes to your current student record.
        </p>
      </div>

      <div className="space-y-8 px-5 py-6 sm:px-7">
        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Current school status
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {enrollmentFields.map((field) => (
              <TextField key={field.id} {...field} value={student[field.id] || "Not available"} readOnly />
            ))}
          </div>
        </section>

        {studentUpdateSections.map((section) => (
          <section key={section.title} className="space-y-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
              {section.title}
            </h2>
            <FormFields fields={section.fields} values={student} />
          </section>
        ))}
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:px-7">
        {state.message ? (
          <p className={state.status === "success" ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-700"}>
            {state.message}
          </p>
        ) : null}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save updates"}
          </button>
        </div>
      </div>
    </form>
  );
}
