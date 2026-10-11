"use client";

import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ReviewFormValues } from "@/lib/admission/types";


type ReviewStepProps = {
  form: ReviewFormValues;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
};

function displayValue(value: string) {
  return value.trim() ? value : "Not provided";
}

function joinValues(values: string[]) {
  const text = values.map((value) => value.trim()).filter(Boolean).join(", ");
  return text || "Not provided";
}

function joinInline(values: string[]) {
  const text = values.map((value) => value.trim()).filter(Boolean).join(" ");
  return text || "Not provided";
}

function formatProgramType(programType: string) {
  switch (programType) {
    case "Bachelor":
      return "Bachelor's Degree";
    case "SeniorHigh":
      return "Senior High School";
    case "Associate":
      return "Associate Degree";
    default:
      return displayValue(programType);
  }
}

function ResumeSection({
  title,
  eyebrow,
  children,
  first = false,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <section className={cn("py-6", !first && "border-t border-gray-200")}>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500">
            {eyebrow}
          </p>
          <h4 className="mt-2 text-base font-semibold text-gray-950">{title}</h4>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function ResumeRows({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    fullWidth?: boolean;
  }>;
}) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className={item.fullWidth ? "sm:col-span-2" : ""}>
          <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm leading-6 text-gray-700">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AdmissionReviewDetails({
  form,
  consent = false,
  onConsentChange,
  showConsent = true,
  className,
}: {
  form: ReviewFormValues;
  consent?: boolean;
  onConsentChange?: (value: boolean) => void;
  showConsent?: boolean;
  className?: string;
}) {
  const homeAddress = joinValues([
    form.address_house_number,
    form.address_street,
    form.address_subdivision,
    form.address_barangay,
    form.address_city,
    form.address_province,
    form.address_postal_code,
  ]);
  const lastSchoolAddress = joinValues([
    form.last_school_house_number,
    form.last_school_street,
    form.last_school_subdivision,
    form.last_school_barangay,
    form.last_school_city,
    form.last_school_province,
    form.last_school_postal_code,
  ]);
  const studentName = joinInline([
    form.student_first_name,
    form.student_middle_name,
    form.student_last_name,
    form.student_suffix,
  ]);
  const guardianName = joinInline([
    form.guardian_first_name,
    form.guardian_middle_name,
    form.guardian_last_name,
    form.guardian_suffix,
  ]);
  const branchSummary = joinValues([form.branch_title, form.branch_code]);
  const selectedProgram = joinValues([
    form.program_code && form.program_label
      ? `${form.program_code} - ${form.program_label}`
      : "",
    form.academic_level_label,
  ]);

  const rows = (...fields: [string, keyof ReviewFormValues][]) =>
    fields.map(([label, field]) => ({ label, value: displayValue(form[field]) }));
  const sections = [
    {
      title: "Applicant and program", eyebrow: "Selection",
      items: [
        ...rows(["Applicant type", "applicant_type"]),
        { label: "Branch", value: branchSummary },
        { label: "Program type", value: formatProgramType(form.program_type) },
        { label: "Program", value: selectedProgram },
      ],
    },
    {
      title: "Student details", eyebrow: "Student",
      items: [
        { label: "Student name", value: studentName },
        ...rows(["Birth date", "student_birth_date"], ["Gender", "student_gender"],
          ["Civil status", "student_civil_status"], ["Citizenship", "student_citizenship"],
          ["Birthplace", "student_birthplace"], ["Religion", "student_religion"]),
      ],
    },
    {
      title: "Contact and address", eyebrow: "Contact",
      items: [
        ...rows(["Email", "contact_email"], ["Mobile number", "contact_phone"], ["Facebook", "contact_facebook"]),
        { label: "Home address", value: homeAddress, fullWidth: true },
      ],
    },
    {
      title: "Previous school", eyebrow: "Academic record",
      items: [
        ...rows(["School name", "last_school_name"], ["Short name", "last_school_short_name"],
          ["School ID", "last_school_id"], ["School type", "last_school_type"]),
        { label: "School address", value: lastSchoolAddress, fullWidth: true },
        ...rows(["Last school year", "last_school_year"], ["Year level completed", "last_school_year_level"],
          ["Graduation date", "last_school_graduation_date"]),
      ],
    },
    {
      title: "Parent or guardian", eyebrow: "Guardian",
      items: [
        { label: "Guardian name", value: guardianName },
        ...rows(["Relationship", "guardian_relationship"], ["Contact number", "guardian_contact_number"],
          ["Occupation", "guardian_occupation"]),
      ],
    },
    ...(form.current_student_record_id ? [{
      title: "Verified current student record", eyebrow: "Verification",
      items: rows(["Verified student", "current_student_verified_name"],
        ["Latest school year", "current_student_verified_school_year"],
        ["Verified program", "current_student_verified_program"], ["Verified branch", "current_student_verified_branch"]),
    }] : []),
  ];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">
          Review your admission details
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Confirm the information below before sending the application to the
          registrar. Use the step navigation on the left if you need to correct
          anything.
        </p>
      </div>

      <div
        className={cn(
          "max-h-[58vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm sm:px-7",
          className
        )}
      >
        <article>
          <header className="pb-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              Admission Review
            </p>
            <h4 className="mt-3 text-2xl font-semibold text-gray-950">
              {studentName === "Not provided" ? "Applicant Record" : studentName}
            </h4>
            <div className="mt-3 grid gap-2 text-sm leading-6 text-gray-600 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-gray-800">Applicant type:</span>{" "}
                {displayValue(form.applicant_type)}
              </p>
              <p>
                <span className="font-semibold text-gray-800">Branch:</span>{" "}
                {branchSummary}
              </p>
              <p className="sm:col-span-2">
                <span className="font-semibold text-gray-800">Selected program:</span>{" "}
                {selectedProgram}
              </p>
            </div>
          </header>

          {sections.map((section, index) => (
            <ResumeSection key={section.title} title={section.title} eyebrow={section.eyebrow} first={index === 0}>
              <ResumeRows items={section.items} />
            </ResumeSection>
          ))}

          {showConsent ? (
          <ResumeSection title="Declaration and consent" eyebrow="Final check">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-full",
                    consent ? "bg-emerald-600 text-white" : "bg-primary text-white"
                  )}
                >
                  <ShieldCheck size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-950">
                    Applicant declaration
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">
                    I confirm that the information in this admission form is true
                    and complete to the best of my knowledge. I understand that
                    the school may review the submitted details and request
                    supporting documents before final approval.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => onConsentChange?.(event.target.checked)}
                  className="mt-1 size-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm leading-6 text-gray-700">
                  I have reviewed this application and give my consent to submit
                  it to the registrar.
                </span>
              </label>
            </div>
          </ResumeSection>
          ) : null}
        </article>
      </div>
    </div>
  );
}

export default function ReviewStep({
  form,
  consent,
  onConsentChange,
}: ReviewStepProps) {
  return (
    <AdmissionReviewDetails
      form={form}
      consent={consent}
      onConsentChange={onConsentChange}
    />
  );
}
