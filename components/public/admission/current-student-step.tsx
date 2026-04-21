"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export type CurrentStudentFieldName =
  | "current_student_number"
  | "current_student_email"
  | "current_student_first_name"
  | "current_student_last_name"
  | "current_student_birth_date"
  | "current_last_school_year_attended";

export type CurrentStudentVerification = {
  recordId: string;
  displayName: string;
  schoolYear: string;
  program: string;
  branch: string;
};

export type CurrentStudentStepHandle = {
  verify: () => Promise<boolean>;
};

type CurrentStudentFormValues = Record<
  | CurrentStudentFieldName
  | "branch_id"
  | "current_student_record_id"
  | "current_student_verified_name"
  | "current_student_verified_school_year"
  | "current_student_verified_program"
  | "current_student_verified_branch",
  string
>;

type CurrentStudentStepProps = {
  form: CurrentStudentFormValues;
  onChange: (field: CurrentStudentFieldName, value: string) => void;
  onVerified: (verification: CurrentStudentVerification) => void;
};

type VerificationStatus = "idle" | "verifying" | "failed" | "verified";

type VerifyStudentResponse = {
  verified?: boolean;
  message?: string;
  student?: {
    id: string;
    displayName: string;
    latestEnrollment?: {
      schoolYear: string | null;
      branch: string | null;
      program: string | null;
      yearLevel: string | null;
      section: string | null;
    } | null;
  };
};

const inputClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: CurrentStudentFieldName;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        {label}
        {required && <span className="text-secondary"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs leading-5 text-gray-500">{hint}</p>}
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
  hint,
}: {
  id: CurrentStudentFieldName;
  label: string;
  value: string;
  onChange: (field: CurrentStudentFieldName, value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        aria-required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(id, event.target.value)}
        className={inputClass}
      />
    </Field>
  );
}

function formatProgramSummary({
  program,
  yearLevel,
  section,
}: {
  program?: string | null;
  yearLevel?: string | null;
  section?: string | null;
}) {
  return [program, yearLevel, section].filter(Boolean).join(" / ");
}

const statusCardClass = {
  idle: "border-gray-200 bg-gray-50 text-gray-700",
  verifying: "border-primary/20 bg-primary/5 text-primary",
  failed: "border-red-200 bg-red-50 text-red-700",
  verified: "border-emerald-200 bg-emerald-50 text-emerald-800",
} as const;

const statusIconClass = {
  idle: "text-primary",
  verifying: "text-primary",
  failed: "text-red-600",
  verified: "text-emerald-600",
} as const;

const CurrentStudentStep = React.forwardRef<
  CurrentStudentStepHandle,
  CurrentStudentStepProps
>(function CurrentStudentStep({ form, onChange, onVerified }, ref) {
  const [status, setStatus] = React.useState<VerificationStatus>("idle");
  const [message, setMessage] = React.useState("");

  const requiredComplete = Boolean(
    form.current_student_number &&
      form.current_student_email &&
      form.current_student_first_name &&
      form.current_student_last_name &&
      form.current_student_birth_date &&
      form.current_last_school_year_attended
  );
  const verified = Boolean(form.current_student_record_id);

  function handleChange(field: CurrentStudentFieldName, value: string) {
    setStatus("idle");
    setMessage("");
    onChange(field, value);
  }

  const verifyStudent = React.useCallback(async () => {
    if (verified) {
      setStatus("verified");
      setMessage("Student record verified. You can continue.");
      return true;
    }

    if (!requiredComplete) {
      setStatus("failed");
      setMessage("Complete all verification fields before checking the record.");
      return false;
    }

    try {
      setStatus("verifying");
      setMessage("");

      const response = await fetch("/api/students/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          branchId: form.branch_id,
          studentNumber: form.current_student_number,
          studentEmail: form.current_student_email,
          firstName: form.current_student_first_name,
          lastName: form.current_student_last_name,
          birthDate: form.current_student_birth_date,
          lastSchoolYearAttended: form.current_last_school_year_attended,
        }),
      });

      const data = (await response.json()) as VerifyStudentResponse;

      if (!response.ok || !data.verified || !data.student) {
        throw new Error(
          data.message ?? "No matching student record was found."
        );
      }

      const latestEnrollment = data.student.latestEnrollment;

      onVerified({
        recordId: data.student.id,
        displayName: data.student.displayName,
        schoolYear:
          latestEnrollment?.schoolYear ??
          form.current_last_school_year_attended,
        program: formatProgramSummary({
          program: latestEnrollment?.program,
          yearLevel: latestEnrollment?.yearLevel,
          section: latestEnrollment?.section,
        }),
        branch: latestEnrollment?.branch ?? "",
      });
      setStatus("verified");
      setMessage("Student record verified. You can continue.");
      return true;
    } catch (error) {
      setStatus("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "No matching student record was found."
      );
      return false;
    }
  }, [form, onVerified, requiredComplete, verified]);

  React.useImperativeHandle(
    ref,
    () => ({
      verify: verifyStudent,
    }),
    [verifyStudent]
  );

  const resolvedStatus: VerificationStatus =
    verified && status !== "failed" ? "verified" : status;
  const statusMessage =
    resolvedStatus === "verified"
      ? message || "Student record verified. You can continue."
      : resolvedStatus === "verifying"
        ? "Checking your record against the registrar database."
        : resolvedStatus === "idle"
          ? "Continue will verify your existing student details before you can proceed."
          : message;

  const StatusIcon =
    resolvedStatus === "failed"
      ? AlertTriangle
      : resolvedStatus === "verified"
        ? CheckCircle2
        : ShieldCheck;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">
          Verify your student record
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Enter the details from your latest DCSA record. These fields help the
          registrar confirm that the existing student account belongs to you.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          id="current_student_number"
          label="Student number"
          type="number"
          value={form.current_student_number}
          onChange={handleChange}
          placeholder="Example: 2612345"
          autoComplete="off"
          required
        />
        <TextField
          id="current_student_email"
          label="Student email"
          type="email"
          value={form.current_student_email}
          onChange={handleChange}
          placeholder="name@example.com"
          autoComplete="email"
          required
        />
        <TextField
          id="current_student_first_name"
          label="First name"
          value={form.current_student_first_name}
          onChange={handleChange}
          autoComplete="given-name"
          required
        />
        <TextField
          id="current_student_last_name"
          label="Last name"
          value={form.current_student_last_name}
          onChange={handleChange}
          autoComplete="family-name"
          required
        />
        <TextField
          id="current_student_birth_date"
          label="Birth date"
          type="date"
          value={form.current_student_birth_date}
          onChange={handleChange}
          autoComplete="bday"
          required
        />
        <TextField
          id="current_last_school_year_attended"
          label="Last school year attended"
          value={form.current_last_school_year_attended}
          onChange={handleChange}
          placeholder="Example: 2025-2026"
          hint="Use the school year from your latest DCSA enrollment."
          required
        />
      </div>

      <div
        aria-live="polite"
        className={cn(
          "rounded-lg border p-4",
          statusCardClass[resolvedStatus]
        )}
      >
        <div className="flex items-start gap-3">
          <StatusIcon
            className={cn("mt-0.5 size-5 shrink-0", statusIconClass[resolvedStatus])}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {resolvedStatus === "verified"
                ? "Student record confirmed"
                : resolvedStatus === "verifying"
                  ? "Verifying your student record"
                  : resolvedStatus === "failed"
                    ? "Unable to verify this record"
                    : "Verification required"}
            </p>
            <p className="mt-1 text-sm leading-6">{statusMessage}</p>
          </div>
        </div>

        {verified && (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-semibold">Verified student</dt>
              <dd className="mt-1 text-gray-700">
                {form.current_student_verified_name}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Latest school year</dt>
              <dd className="mt-1 text-gray-700">
                {form.current_student_verified_school_year}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Program</dt>
              <dd className="mt-1 text-gray-700">
                {form.current_student_verified_program || "Program unavailable"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Branch</dt>
              <dd className="mt-1 text-gray-700">
                {form.current_student_verified_branch || "Branch unavailable"}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
});

CurrentStudentStep.displayName = "CurrentStudentStep";

export default CurrentStudentStep;
