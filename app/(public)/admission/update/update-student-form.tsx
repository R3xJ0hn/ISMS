"use client";

import * as React from "react";

import {
  updateStudentInformation,
  type UpdateStudentFormState,
} from "./actions";
import type { StudentUpdateRecord } from "@/lib/types";

const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const readOnlyInputClass =
  "h-11 w-full rounded-md border border-gray-200 bg-gray-100 px-3 text-sm text-gray-500 placeholder:text-gray-400";

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
            Current school status
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Enrollment status" htmlFor="latestEnrollmentStatus">
              <input
                id="latestEnrollmentStatus"
                value={student.latestEnrollmentStatus || "Not available"}
                readOnly
                className={readOnlyInputClass}
              />
            </Field>
            <Field label="Latest school year" htmlFor="latestEnrollmentSchoolYear">
              <input
                id="latestEnrollmentSchoolYear"
                value={student.latestEnrollmentSchoolYear || "Not available"}
                readOnly
                className={readOnlyInputClass}
              />
            </Field>
            <Field label="Branch" htmlFor="latestEnrollmentBranch">
              <input
                id="latestEnrollmentBranch"
                value={student.latestEnrollmentBranch || "Not available"}
                readOnly
                className={readOnlyInputClass}
              />
            </Field>
            <Field label="Program" htmlFor="latestEnrollmentProgram">
              <input
                id="latestEnrollmentProgram"
                value={student.latestEnrollmentProgram || "Not available"}
                readOnly
                className={readOnlyInputClass}
              />
            </Field>
            <Field label="Year level" htmlFor="latestEnrollmentYearLevel">
              <input
                id="latestEnrollmentYearLevel"
                value={student.latestEnrollmentYearLevel || "Not available"}
                readOnly
                className={readOnlyInputClass}
              />
            </Field>
            <Field label="Section" htmlFor="latestEnrollmentSection">
              <input
                id="latestEnrollmentSection"
                value={student.latestEnrollmentSection || "Not available"}
                readOnly
                className={readOnlyInputClass}
              />
            </Field>
          </div>
        </section>

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
            <Field label="Gender" htmlFor="gender">
              <select
                id="gender"
                name="gender"
                defaultValue={student.gender ?? ""}
                className={selectClass}
              >
                <option value="">Not specified</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </Field>
            <Field label="Civil status" htmlFor="civilStatus">
              <select
                id="civilStatus"
                name="civilStatus"
                defaultValue={student.civilStatus ?? ""}
                className={selectClass}
              >
                <option value="">Not specified</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
              </select>
            </Field>
            <Field label="Citizenship" htmlFor="citizenship">
              <input
                id="citizenship"
                name="citizenship"
                defaultValue={student.citizenship ?? ""}
                className={inputClass}
              />
            </Field>
            <Field label="Birthplace" htmlFor="birthplace">
              <input
                id="birthplace"
                name="birthplace"
                defaultValue={student.birthplace ?? ""}
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
            <Field label="Phone" htmlFor="phone">
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={student.phone ?? ""}
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

        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Parent or guardian
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="First name" htmlFor="guardianFirstName" required>
              <input
                id="guardianFirstName"
                name="guardianFirstName"
                defaultValue={student.guardianFirstName}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Last name" htmlFor="guardianLastName" required>
              <input
                id="guardianLastName"
                name="guardianLastName"
                defaultValue={student.guardianLastName}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Middle name" htmlFor="guardianMiddleName">
              <input
                id="guardianMiddleName"
                name="guardianMiddleName"
                defaultValue={student.guardianMiddleName}
                className={inputClass}
              />
            </Field>
            <Field label="Suffix" htmlFor="guardianSuffix">
              <input
                id="guardianSuffix"
                name="guardianSuffix"
                defaultValue={student.guardianSuffix}
                className={inputClass}
              />
            </Field>
            <Field label="Relationship to student" htmlFor="guardianRelationship" required>
              <input
                id="guardianRelationship"
                name="guardianRelationship"
                defaultValue={student.guardianRelationship}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Contact number" htmlFor="guardianContactNumber" required>
              <input
                id="guardianContactNumber"
                name="guardianContactNumber"
                type="tel"
                defaultValue={student.guardianContactNumber}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Occupation" htmlFor="guardianOccupation">
              <input
                id="guardianOccupation"
                name="guardianOccupation"
                defaultValue={student.guardianOccupation}
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">
            Last school attended
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="School name" htmlFor="lastSchoolName" required>
              <input
                id="lastSchoolName"
                name="lastSchoolName"
                defaultValue={student.lastSchoolName}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Short name" htmlFor="lastSchoolShortName">
              <input
                id="lastSchoolShortName"
                name="lastSchoolShortName"
                defaultValue={student.lastSchoolShortName}
                className={inputClass}
              />
            </Field>
            <Field label="School ID" htmlFor="lastSchoolId">
              <input
                id="lastSchoolId"
                name="lastSchoolId"
                defaultValue={student.lastSchoolId}
                className={inputClass}
              />
            </Field>
            <Field label="School type" htmlFor="lastSchoolType" required>
              <select
                id="lastSchoolType"
                name="lastSchoolType"
                defaultValue={student.lastSchoolType}
                required
                className={selectClass}
              >
                <option value="" disabled>
                  Select school type
                </option>
                <option value="Public">Public</option>
                <option value="Private">Private</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Barangay" htmlFor="lastSchoolBarangay" required>
              <input
                id="lastSchoolBarangay"
                name="lastSchoolBarangay"
                defaultValue={student.lastSchoolBarangay}
                required
                className={inputClass}
              />
            </Field>
            <Field label="City / municipality" htmlFor="lastSchoolCity" required>
              <input
                id="lastSchoolCity"
                name="lastSchoolCity"
                defaultValue={student.lastSchoolCity}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Province" htmlFor="lastSchoolProvince" required>
              <input
                id="lastSchoolProvince"
                name="lastSchoolProvince"
                defaultValue={student.lastSchoolProvince}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Postal code" htmlFor="lastSchoolPostalCode">
              <input
                id="lastSchoolPostalCode"
                name="lastSchoolPostalCode"
                defaultValue={student.lastSchoolPostalCode}
                className={inputClass}
              />
            </Field>
            <Field label="Last school year attended" htmlFor="lastSchoolYear" required>
              <input
                id="lastSchoolYear"
                name="lastSchoolYear"
                defaultValue={student.lastSchoolYear}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Year level completed" htmlFor="lastSchoolYearLevel" required>
              <input
                id="lastSchoolYearLevel"
                name="lastSchoolYearLevel"
                defaultValue={student.lastSchoolYearLevel}
                required
                className={inputClass}
              />
            </Field>
            <Field label="Graduation date" htmlFor="lastSchoolGraduationDate">
              <input
                id="lastSchoolGraduationDate"
                name="lastSchoolGraduationDate"
                type="date"
                defaultValue={student.lastSchoolGraduationDate}
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
