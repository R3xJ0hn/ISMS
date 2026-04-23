"use client";

import * as React from "react";

import {
  updateStudentInformation,
  type UpdateStudentFormState,
} from "./actions";
import type { StudentUpdateRecord } from "@/lib/admission/student-update";

const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const selectClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const initialState: UpdateStudentFormState = {
  status: "idle",
  message: "",
};

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-gray-800">
        {label}
        {required ? <span className="text-secondary"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export default function UpdateStudentForm({
  student,
}: {
  student: StudentUpdateRecord;
}) {
  const [state, formAction, pending] = React.useActionState(
    updateStudentInformation,
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
          Student record update
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
          Update your saved student information
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Review the fields below and save any changes to your current student
          record.
        </p>
      </div>

      <div className="space-y-8 px-5 py-6 sm:px-7">
        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Personal details
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="First name" htmlFor="firstName" required>
              <input
                id="firstName"
                name="firstName"
                defaultValue={student.firstName}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Last name" htmlFor="lastName" required>
              <input
                id="lastName"
                name="lastName"
                defaultValue={student.lastName}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Middle name" htmlFor="middleName">
              <input
                id="middleName"
                name="middleName"
                defaultValue={student.middleName}
                className={inputClass}
              />
            </Field>
            <Field label="Suffix" htmlFor="suffix">
              <input
                id="suffix"
                name="suffix"
                defaultValue={student.suffix}
                className={inputClass}
              />
            </Field>
            <Field label="Birth date" htmlFor="birthDate" required>
              <input
                id="birthDate"
                name="birthDate"
                type="date"
                defaultValue={student.birthDate}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Gender" htmlFor="gender" required>
              <select
                id="gender"
                name="gender"
                defaultValue={student.gender}
                required
                className={selectClass}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </Field>
            <Field label="Civil status" htmlFor="civilStatus" required>
              <select
                id="civilStatus"
                name="civilStatus"
                defaultValue={student.civilStatus}
                required
                className={selectClass}
              >
                <option value="Single">Single</option>
                <option value="Married">Married</option>
              </select>
            </Field>
            <Field label="Citizenship" htmlFor="citizenship" required>
              <input
                id="citizenship"
                name="citizenship"
                defaultValue={student.citizenship}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Birthplace" htmlFor="birthplace" required>
              <input
                id="birthplace"
                name="birthplace"
                defaultValue={student.birthplace}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Religion" htmlFor="religion">
              <input
                id="religion"
                name="religion"
                defaultValue={student.religion}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Contact details
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Email" htmlFor="email" required>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={student.email}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Phone" htmlFor="phone" required>
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={student.phone}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Facebook account" htmlFor="facebookAccount">
              <input
                id="facebookAccount"
                name="facebookAccount"
                defaultValue={student.facebookAccount}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Home address
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="House number / unit" htmlFor="addressHouseNumber">
              <input
                id="addressHouseNumber"
                name="addressHouseNumber"
                defaultValue={student.addressHouseNumber}
                className={inputClass}
              />
            </Field>
            <Field label="Subdivision / village" htmlFor="addressSubdivision">
              <input
                id="addressSubdivision"
                name="addressSubdivision"
                defaultValue={student.addressSubdivision}
                className={inputClass}
              />
            </Field>
            <Field label="Street" htmlFor="addressStreet">
              <input
                id="addressStreet"
                name="addressStreet"
                defaultValue={student.addressStreet}
                className={inputClass}
              />
            </Field>
            <Field label="Barangay" htmlFor="addressBarangay" required>
              <input
                id="addressBarangay"
                name="addressBarangay"
                defaultValue={student.addressBarangay}
                required
                className={inputClass}
              />
            </Field>
            <Field label="City / municipality" htmlFor="addressCity" required>
              <input
                id="addressCity"
                name="addressCity"
                defaultValue={student.addressCity}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Province" htmlFor="addressProvince" required>
              <input
                id="addressProvince"
                name="addressProvince"
                defaultValue={student.addressProvince}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Postal code" htmlFor="addressPostalCode">
              <input
                id="addressPostalCode"
                name="addressPostalCode"
                defaultValue={student.addressPostalCode}
                className={inputClass}
              />
            </Field>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:px-7">
        {state.message ? (
          <p
            className={
              state.status === "success"
                ? "text-sm font-medium text-emerald-700"
                : "text-sm font-medium text-red-700"
            }
          >
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
