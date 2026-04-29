"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  editAdmittedStudentAction,
  type EditAdmittedStudentState,
} from "@/app/portal/admission/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AdmittedStudentEditRecord = {
  applicationId: string;
  studentId: string;
  applicantType: string;
  branchId: string;
  programId: string;
  academicLevelsId: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleName: string;
  suffix: string;
  birthDate: string;
  gender: string;
  civilStatus: string;
  citizenship: string;
  birthplace: string;
  religion: string;
  email: string;
  phone: string;
  facebookAccount: string;
  addressHouseNumber: string;
  addressSubdivision: string;
  addressStreet: string;
  addressBarangay: string;
  addressCity: string;
  addressProvince: string;
  addressPostalCode: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianMiddleName: string;
  guardianSuffix: string;
  guardianRelationship: string;
  guardianContactNumber: string;
  guardianOccupation: string;
  lastSchoolName: string;
  lastSchoolId: string;
  lastSchoolShortName: string;
  lastSchoolType: string;
  lastSchoolHouseNumber: string;
  lastSchoolSubdivision: string;
  lastSchoolStreet: string;
  lastSchoolBarangay: string;
  lastSchoolCity: string;
  lastSchoolProvince: string;
  lastSchoolPostalCode: string;
  lastSchoolYear: string;
  lastSchoolGraduationDate: string;
  lastSchoolYearLevel: string;
};

export type AdmittedStudentEditOptions = {
  branches: Array<{
    id: string;
    title: string;
  }>;
  programs: Array<{
    id: string;
    code: string;
    label: string;
    programType: string;
  }>;
  academicLevels: Array<{
    id: string;
    label: string;
  }>;
};

const initialState = {
  success: false,
  message: "",
} satisfies EditAdmittedStudentState;

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

export function EditAdmittedStudentForm({
  student,
  options,
}: {
  student: AdmittedStudentEditRecord;
  options: AdmittedStudentEditOptions;
}) {
  const [state, formAction, pending] = useActionState(
    editAdmittedStudentAction,
    initialState
  );

  return (
    <form action={formAction} className="space-y-8">
      <input name="studentId" type="hidden" value={student.studentId} />
      <input name="applicationId" type="hidden" value={student.applicationId} />

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Applicant And Program
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Applicant type" required>
            <select
              name="applicantType"
              defaultValue={student.applicantType}
              required
              className={selectClass}
            >
              <option value="new">New</option>
              <option value="existing">Existing</option>
            </select>
          </Field>
          <Field label="Branch" required>
            <select
              name="branchId"
              defaultValue={student.branchId}
              required
              className={selectClass}
            >
              {options.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Program" required>
            <select
              name="programId"
              defaultValue={student.programId}
              required
              className={selectClass}
            >
              {options.programs.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} - {program.label} ({program.programType})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Academic level" required>
            <select
              name="academicLevelsId"
              defaultValue={student.academicLevelsId}
              required
              className={selectClass}
            >
              {options.academicLevels.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Student Details
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Student number" required>
            <Input name="studentNumber" defaultValue={student.studentNumber} required />
          </Field>
          <Field label="Student email" required>
            <Input name="email" type="email" defaultValue={student.email} required />
          </Field>
          <Field label="First name" required>
            <Input name="firstName" defaultValue={student.firstName} required />
          </Field>
          <Field label="Last name" required>
            <Input name="lastName" defaultValue={student.lastName} required />
          </Field>
          <Field label="Middle name">
            <Input name="middleName" defaultValue={student.middleName} />
          </Field>
          <Field label="Suffix">
            <Input name="suffix" defaultValue={student.suffix} />
          </Field>
          <Field label="Birth date" required>
            <Input name="birthDate" type="date" defaultValue={student.birthDate} required />
          </Field>
          <Field label="Gender" required>
            <select name="gender" defaultValue={student.gender} required className={selectClass}>
              <option value="" disabled>
                Select gender
              </option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </Field>
          <Field label="Civil status">
            <select
              name="civilStatus"
              defaultValue={student.civilStatus}
              className={selectClass}
            >
              <option value="">Not specified</option>
              <option value="Single">Single</option>
              <option value="Married">Married</option>
            </select>
          </Field>
          <Field label="Citizenship">
            <Input name="citizenship" defaultValue={student.citizenship} />
          </Field>
          <Field label="Birthplace" required>
            <Input name="birthplace" defaultValue={student.birthplace} required />
          </Field>
          <Field label="Religion">
            <Input name="religion" defaultValue={student.religion} />
          </Field>
          <Field label="Phone" required>
            <Input name="phone" defaultValue={student.phone} required />
          </Field>
          <Field label="Facebook account">
            <Input name="facebookAccount" defaultValue={student.facebookAccount} />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Home Address
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="House number / unit">
            <Input name="addressHouseNumber" defaultValue={student.addressHouseNumber} />
          </Field>
          <Field label="Subdivision / village">
            <Input name="addressSubdivision" defaultValue={student.addressSubdivision} />
          </Field>
          <Field label="Street">
            <Input name="addressStreet" defaultValue={student.addressStreet} />
          </Field>
          <Field label="Barangay" required>
            <Input name="addressBarangay" defaultValue={student.addressBarangay} required />
          </Field>
          <Field label="City / municipality" required>
            <Input name="addressCity" defaultValue={student.addressCity} required />
          </Field>
          <Field label="Province" required>
            <Input name="addressProvince" defaultValue={student.addressProvince} required />
          </Field>
          <Field label="Postal code">
            <Input name="addressPostalCode" defaultValue={student.addressPostalCode} />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Parent Or Guardian
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="First name" required>
            <Input name="guardianFirstName" defaultValue={student.guardianFirstName} required />
          </Field>
          <Field label="Last name" required>
            <Input name="guardianLastName" defaultValue={student.guardianLastName} required />
          </Field>
          <Field label="Middle name">
            <Input name="guardianMiddleName" defaultValue={student.guardianMiddleName} />
          </Field>
          <Field label="Suffix">
            <Input name="guardianSuffix" defaultValue={student.guardianSuffix} />
          </Field>
          <Field label="Relationship" required>
            <Input
              name="guardianRelationship"
              defaultValue={student.guardianRelationship}
              required
            />
          </Field>
          <Field label="Contact number" required>
            <Input
              name="guardianContactNumber"
              defaultValue={student.guardianContactNumber}
              required
            />
          </Field>
          <Field label="Occupation">
            <Input name="guardianOccupation" defaultValue={student.guardianOccupation} />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Last School Attended
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="School name" required>
            <Input name="lastSchoolName" defaultValue={student.lastSchoolName} required />
          </Field>
          <Field label="Short name">
            <Input name="lastSchoolShortName" defaultValue={student.lastSchoolShortName} />
          </Field>
          <Field label="School ID">
            <Input name="lastSchoolId" defaultValue={student.lastSchoolId} />
          </Field>
          <Field label="School type" required>
            <select
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
          <Field label="House number / unit">
            <Input name="lastSchoolHouseNumber" defaultValue={student.lastSchoolHouseNumber} />
          </Field>
          <Field label="Subdivision / village">
            <Input name="lastSchoolSubdivision" defaultValue={student.lastSchoolSubdivision} />
          </Field>
          <Field label="Street">
            <Input name="lastSchoolStreet" defaultValue={student.lastSchoolStreet} />
          </Field>
          <Field label="Barangay" required>
            <Input name="lastSchoolBarangay" defaultValue={student.lastSchoolBarangay} required />
          </Field>
          <Field label="City / municipality" required>
            <Input name="lastSchoolCity" defaultValue={student.lastSchoolCity} required />
          </Field>
          <Field label="Province" required>
            <Input name="lastSchoolProvince" defaultValue={student.lastSchoolProvince} required />
          </Field>
          <Field label="Postal code">
            <Input name="lastSchoolPostalCode" defaultValue={student.lastSchoolPostalCode} />
          </Field>
          <Field label="Last school year" required>
            <Input name="lastSchoolYear" defaultValue={student.lastSchoolYear} required />
          </Field>
          <Field label="Year level completed" required>
            <Input
              name="lastSchoolYearLevel"
              defaultValue={student.lastSchoolYearLevel}
              required
            />
          </Field>
          <Field label="Graduation date">
            <Input
              name="lastSchoolGraduationDate"
              type="date"
              defaultValue={student.lastSchoolGraduationDate}
            />
          </Field>
        </div>
      </section>

      {state.message ? (
        <p
          className={
            state.success
              ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
              : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-4 backdrop-blur">
        <Button asChild type="button" variant="outline">
          <Link href="/portal/admission">Back</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
