"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { steps, type Step, type StepId } from "./config";
import ApplicantStep from "./applicant-step";

export const initialFormValues = {
  applicant_type: "",
  branch_id: "",
  student_first_name: "",
  student_last_name: "",
  student_middle_name: "",
  student_suffix: "",
  student_birth_date: "",
  student_gender: "",
  student_civil_status: "",
  student_citizenship: "",
  student_birthplace: "",
  student_religion: "",
  contact_email: "",
  contact_phone: "",
  contact_facebook: "",
  address_house_number: "",
  address_subdivision: "",
  address_street: "",
  address_barangay: "",
  address_city: "",
  address_province: "",
  address_postal_code: "",
  last_school_name: "",
  last_school_id: "",
  last_school_short_name: "",
  last_school_type: "",
  last_school_house_number: "",
  last_school_subdivision: "",
  last_school_street: "",
  last_school_barangay: "",
  last_school_city: "",
  last_school_province: "",
  last_school_postal_code: "",
  last_school_year: "",
  last_school_graduation_date: "",
  last_school_year_level: "",
  guardian_last_name: "",
  guardian_first_name: "",
  guardian_middle_name: "",
  guardian_suffix: "",
  guardian_relationship: "",
  guardian_contact_number: "",
  guardian_occupation: "",
  current_student_number: "",
  current_year_level: "",
  current_section: "",
  current_school_year: "",
};

type FieldName = keyof typeof initialFormValues;
type AdmissionFormValues = typeof initialFormValues;

function StepHeader({ step, currentIndex }: { step: Step; currentIndex: number }) {
  const Icon = step.icon;

  return (
    <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">
        Step {currentIndex + 1} of {steps.length} / {step.eyebrow}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Icon className="size-7 text-primary" aria-hidden="true" />
        <h2 className="text-2xl font-bold tracking-tight text-gray-950">
          {step.title}
        </h2>
      </div>
    </div>
  );
}

function stepIsComplete(
  stepId: StepId,
  form: AdmissionFormValues,
  consent: boolean
) {
  switch (stepId) {
    case "applicant":
      return Boolean(form.applicant_type && form.branch_id);
    case "program":
      return true;
    case "student":
      return Boolean(
        form.student_first_name &&
          form.student_last_name &&
          form.student_birth_date &&
          form.student_gender &&
          form.student_civil_status &&
          form.student_citizenship &&
          form.student_birthplace
      );
    case "contact":
      return Boolean(
        form.contact_email &&
          form.contact_phone &&
          form.address_barangay &&
          form.address_city &&
          form.address_province
      );
    case "lastSchool":
      return Boolean(
        form.last_school_name &&
          form.last_school_type &&
          form.last_school_barangay &&
          form.last_school_city &&
          form.last_school_province &&
          form.last_school_year &&
          form.last_school_year_level
      );
    case "guardian":
      return Boolean(
        form.guardian_first_name &&
          form.guardian_last_name &&
          form.guardian_relationship &&
          form.guardian_contact_number
      );
    case "currentStudent":
      return true;
    case "review":
      return consent;
    default:
      return false;
  }
}

function firstIncompleteStepIndex(form: AdmissionFormValues, consent: boolean) {
  return steps.findIndex((step) => !stepIsComplete(step.id, form, consent));
}

export default function AdmissionWizard() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [form, setForm] = React.useState<AdmissionFormValues>(
    initialFormValues
  );
  const [consent, setConsent] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const currentStep = steps[currentIndex];
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;
  const currentStepComplete = stepIsComplete(currentStep.id, form, consent);
  const incompleteStepIndex = firstIncompleteStepIndex(form, consent);
  const formComplete = incompleteStepIndex === -1;

  function canNavigateToStep(index: number) {
    if (index === currentIndex) {
      return true;
    }

    return steps
      .slice(0, index)
      .every((step) => stepIsComplete(step.id, form, consent));
  }

  function updateField(field: FieldName, value: string) {
    setSubmitted(false);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateConsent(value: boolean) {
    setSubmitted(false);
    setConsent(value);
  }

  function goNext() {
    const nextIndex = Math.min(currentIndex + 1, steps.length - 1);

    if (!currentStepComplete || !canNavigateToStep(nextIndex)) {
      return;
    }

    setCurrentIndex(nextIndex);
  }

  function goBack() {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const invalidStepIndex = firstIncompleteStepIndex(form, consent);

    if (invalidStepIndex !== -1) {
      setSubmitted(false);
      setCurrentIndex(invalidStepIndex);
      return;
    }

    setSubmitted(true);
  }

  function renderStep() {
    switch (currentStep.id) {
      case "applicant":
        return <ApplicantStep form={form} onChange={updateField} />;
      case "program":
        return (<h2>Program Step</h2>);
      case "student":
        return (<h2>Student Step</h2>);    
      case "contact":
        return (<h2>Contact Step</h2>);
      case "lastSchool":
        return (<h2>Last School Step</h2>);
      case "guardian":
        return (<h2>Guardian Step</h2>);
      case "currentStudent":
        return (<h2>Current Student Step</h2>);
      case "review":
        return ( <h2>Review Step</h2>);
      default:
        return null;
    }
  }

  return (
    <section id="admission-form" className="relative z-10 bg-gray-50 pb-16">
      <div className="mx-auto -mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-500">
                Admission progress
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-950">
                {currentIndex + 1}/{steps.length}
              </p>
            </div>

            <ol className="grid gap-1 p-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const active = index === currentIndex;
                const complete = stepIsComplete(step.id, form, consent);
                const canNavigate = canNavigateToStep(index);

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (canNavigate) {
                          setCurrentIndex(index);
                        }
                      }}
                      disabled={!canNavigate}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-md px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/25",
                        active
                          ? "bg-primary text-white"
                          : canNavigate
                            ? "text-gray-700 hover:bg-gray-100"
                            : "cursor-not-allowed text-gray-400 opacity-70"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-md border",
                          active
                            ? "border-white/35 bg-white/15"
                            : complete
                              ? "border-primary bg-primary text-white"
                              : "border-gray-200 bg-white text-gray-500"
                        )}
                      >
                        {complete && !active ? (
                          <Check size={16} aria-hidden="true" />
                        ) : (
                          <Icon size={16} aria-hidden="true" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">
                          {step.label}
                        </span>
                        <span
                          className={cn(
                            "block truncate text-xs",
                            active ? "text-white/80" : "text-gray-500"
                          )}
                        >
                          {step.eyebrow}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="border-t border-gray-200 p-5">
              <div className="flex items-start gap-3 text-sm leading-6 text-gray-600">
                <BookOpenCheck
                  className="mt-0.5 size-5 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <p>
                  Prepare a valid ID, report card or transcript, birth
                  certificate, and latest 2x2 photo before submission.
                </p>
              </div>
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <StepHeader step={currentStep} currentIndex={currentIndex} />

            <div className="min-h-140 px-5 py-6 sm:px-7">
              {renderStep()}
            </div>

            <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              {(!currentStepComplete) && (
                 <p className="text-sm font-medium text-secondary">
                    Complete the required fields to continue.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isFirstStep}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>

                {isLastStep ? (
                  <button
                    type="submit"
                    disabled={!formComplete}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary px-5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Submit for Review
                    <Send size={16} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!currentStepComplete}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
