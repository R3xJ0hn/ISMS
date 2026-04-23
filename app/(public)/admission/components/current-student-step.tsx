"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { verifyCurrentStudent } from "../actions";

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
  message?: string;
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
  disabled,
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
  disabled?: boolean;
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
        disabled={disabled}
        onChange={(event) => onChange(id, event.target.value)}
        className={cn(
          inputClass,
          disabled && "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-500"
        )}
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
  const verifyRequestIdRef = React.useRef(0);
  const activeVerificationSignatureRef = React.useRef<string | null>(null);

  const requiredComplete = Boolean(
    form.current_student_number &&
      form.current_student_email &&
      form.current_student_first_name &&
      form.current_student_last_name &&
      form.current_student_birth_date &&
      form.current_last_school_year_attended
  );
  const verified = Boolean(form.current_student_record_id);
  const verifying = status === "verifying";
  const verificationSignature = [
    form.branch_id,
    form.current_student_number,
    form.current_student_email,
    form.current_student_first_name,
    form.current_student_last_name,
    form.current_student_birth_date,
    form.current_last_school_year_attended,
  ].join("\u0000");

  const cancelPendingVerification = React.useCallback(() => {
    verifyRequestIdRef.current += 1;
    activeVerificationSignatureRef.current = null;
  }, []);

  function handleChange(field: CurrentStudentFieldName, value: string) {
    cancelPendingVerification();
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

    cancelPendingVerification();

    const requestId = verifyRequestIdRef.current + 1;
    verifyRequestIdRef.current = requestId;
    activeVerificationSignatureRef.current = verificationSignature;

    try {
      setStatus("verifying");
      setMessage("");

      const data = await verifyCurrentStudent({
        branchId: form.branch_id,
        studentNumber: form.current_student_number,
        studentEmail: form.current_student_email,
        firstName: form.current_student_first_name,
        lastName: form.current_student_last_name,
        birthDate: form.current_student_birth_date,
        lastSchoolYearAttended: form.current_last_school_year_attended,
      });

      if (verifyRequestIdRef.current !== requestId) {
        return false;
      }

      if (!data.verified || !data.student) {
        throw new Error(
          data.message ?? "No matching student record was found."
        );
      }

      const latestEnrollment = data.student.latestEnrollment;

      if (verifyRequestIdRef.current !== requestId) {
        return false;
      }

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
        message:
          data.message ??
          "Student record verified. Please check your email inbox or spam folder for the update link.",
      });

      if (verifyRequestIdRef.current !== requestId) {
        return false;
      }

      setStatus("verified");
      setMessage(
        data.message ?? "Student record verified. You can continue."
      );
      return true;
    } catch (error) {
      if (verifyRequestIdRef.current !== requestId) {
        return false;
      }

      setStatus("failed");
      setMessage(
        error instanceof Error
          ? error.message
          : "No matching student record was found."
      );
      return false;
    } finally {
      if (verifyRequestIdRef.current === requestId) {
        activeVerificationSignatureRef.current = null;
      }
    }
  }, [
    cancelPendingVerification,
    form,
    onVerified,
    requiredComplete,
    verificationSignature,
    verified,
  ]);

  React.useEffect(() => {
    if (
      verifying &&
      activeVerificationSignatureRef.current !== verificationSignature
    ) {
      cancelPendingVerification();
      setStatus("idle");
      setMessage("");
    }
  }, [cancelPendingVerification, verificationSignature, verifying]);

  React.useEffect(() => cancelPendingVerification, [cancelPendingVerification]);

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
          disabled={verifying}
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
          disabled={verifying}
        />
        <TextField
          id="current_student_first_name"
          label="First name"
          value={form.current_student_first_name}
          onChange={handleChange}
          autoComplete="given-name"
          required
          disabled={verifying}
        />
        <TextField
          id="current_student_last_name"
          label="Last name"
          value={form.current_student_last_name}
          onChange={handleChange}
          autoComplete="family-name"
          required
          disabled={verifying}
        />
        <TextField
          id="current_student_birth_date"
          label="Birth date"
          type="date"
          value={form.current_student_birth_date}
          onChange={handleChange}
          autoComplete="bday"
          required
          disabled={verifying}
        />
        <TextField
          id="current_last_school_year_attended"
          label="Last school year attended"
          value={form.current_last_school_year_attended}
          onChange={handleChange}
          placeholder="Example: 2025-2026"
          hint="Use the school year from your latest DCSA enrollment."
          required
          disabled={verifying}
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
