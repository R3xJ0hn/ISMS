"use client";

import * as React from "react";

import type { StudentUpdatePasswordRecord } from "@/lib/admission/student-update";

import {
  setStudentPortalPassword,
  type SetStudentPasswordFormState,
} from "../actions";

const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const initialState: SetStudentPasswordFormState = {
  status: "idle",
  message: "",
};

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-800">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function SetStudentPasswordForm({
  student,
}: {
  student: StudentUpdatePasswordRecord;
}) {
  const [state, formAction, pending] = React.useActionState(
    setStudentPortalPassword,
    initialState
  );

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <input type="hidden" name="token" value={student.token} />

      <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">
          Portal access
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
          Create your portal password
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Use this password with {student.email} when signing in to
          MyDCSAePortal.
        </p>
      </div>

      <div className="space-y-5 px-5 py-6 sm:px-7">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-950">
            {student.displayName}
          </p>
          <p className="mt-1 text-sm text-gray-600">{student.email}</p>
        </div>

        <Field label="New password" htmlFor="password">
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>

        <Field label="Confirm password" htmlFor="confirmPassword">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:px-7">
        {state.message ? (
          <p className="text-sm font-medium text-red-700">{state.message}</p>
        ) : null}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving..." : "Set password"}
          </button>
        </div>
      </div>
    </form>
  );
}
