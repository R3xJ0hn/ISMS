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
import type { Step } from "./config";
import ApplicantStep from "./applicant-step";
import { DetailsStep } from "./form-sections";
import CurrentStudentStep, {
  type CurrentStudentStepHandle,
  type CurrentStudentVerification,
} from "./current-student-step";
import ProgramStep from "./program-step";
import ReviewStep from "./review-step";
import { submitAdmissionApplication } from "../actions";

import AdmissionConfirmationView from "./admission-confirmation";
import {
  EXISTING_STUDENT, createWizardState, currentStudentInputsComplete,
  firstIncompleteStepIndex, getVisibleSteps, stepIsComplete, wizardReducer,
  type AdmissionConfirmation, type AdmissionFormValues, type FieldName,
} from "./wizard-state";

export { initialFormValues } from "./wizard-state";

function StepHeader({
  step,
  currentIndex,
  totalSteps,
}: {
  step: Step;
  currentIndex: number;
  totalSteps: number;
}) {
  const Icon = step.icon;

  return (
    <div className="border-b border-gray-200 px-5 py-5 sm:px-7">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">
        Step {currentIndex + 1} of {totalSteps} / {step.eyebrow}
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

async function submitAdmission(
  form: AdmissionFormValues,
  consent: boolean
) {
  const data = await submitAdmissionApplication(form, consent);

  if (
    !data.submitted ||
    !data.submissionId ||
    !data.submittedAt
  ) {
    throw new Error(
      data.message ??
        "We could not submit your admission form right now. Please try again."
    );
  }

  return {
    message:
      data.message ??
      "Your admission form has been submitted to the registrar for review.",
    submissionId: data.submissionId,
    submittedAt: data.submittedAt,
  } satisfies AdmissionConfirmation;
}

export default function AdmissionWizard() {
  const [state, dispatch] = React.useReducer(wizardReducer, undefined, createWizardState);
  const { currentIndex, form, consent, verifyingCurrentStudent, submissionStatus,
    submissionError, confirmation, existingStudentNotice } = state;
  const currentStudentStepRef =
    React.useRef<CurrentStudentStepHandle | null>(null);

  const existingStudentFlow = form.applicant_type === EXISTING_STUDENT;
  const visibleSteps = React.useMemo(
    () => getVisibleSteps(form.applicant_type),
    [form.applicant_type]
  );
  const safeCurrentIndex = Math.min(currentIndex, visibleSteps.length - 1);
  const currentStep = visibleSteps[safeCurrentIndex];
  const isFirstStep = safeCurrentIndex === 0;
  const isLastStep = safeCurrentIndex === visibleSteps.length - 1;
  const currentStepComplete = stepIsComplete(currentStep.id, form, consent);
  const showingExistingStudentNotice =
    existingStudentFlow && Boolean(existingStudentNotice);
  const currentStepReadyToContinue =
    showingExistingStudentNotice
      ? false
      : currentStep.id === "currentStudent"
      ? currentStudentInputsComplete(form)
      : currentStepComplete;
  const incompleteStepIndex = firstIncompleteStepIndex(
    form,
    consent,
    visibleSteps
  );
  const formComplete = incompleteStepIndex === -1;

  function canNavigateToStep(index: number) {
    if (index === safeCurrentIndex) {
      return true;
    }

    return visibleSteps
      .slice(0, index)
      .every((step) => stepIsComplete(step.id, form, consent));
  }

  function updateField(field: FieldName, value: string) {
    dispatch({ type: "fieldChanged", field, value });
  }

  function handleCurrentStudentVerified(verification: CurrentStudentVerification) {
    dispatch({ type: "verified", verification });
  }

  function resetWizard() {
    dispatch({ type: "reset" });
  }

  async function goNext() {
    const nextIndex = Math.min(safeCurrentIndex + 1, visibleSteps.length - 1);

    if (
      !currentStepReadyToContinue ||
      verifyingCurrentStudent ||
      submissionStatus === "submitting"
    ) {
      return;
    }

    if (currentStep.id === "currentStudent" && !form.current_student_record_id) {
      dispatch({ type: "verificationPending", value: true });

      try {
        const verified = await currentStudentStepRef.current?.verify();

        if (!verified) {
          return;
        }
      } finally {
        dispatch({ type: "verificationPending", value: false });
      }

      if (existingStudentFlow) {
        return;
      }
    }

    dispatch({ type: "navigated", index: nextIndex });
  }

  function goBack() {
    dispatch({ type: "back" });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "errorChanged", message: "" });

    if (existingStudentFlow) {
      if (!showingExistingStudentNotice) {
        await goNext();
      }
      return;
    }

    const invalidStepIndex = firstIncompleteStepIndex(
      form,
      consent,
      visibleSteps
    );

    if (invalidStepIndex !== -1) {
      dispatch({ type: "navigated", index: invalidStepIndex });
      dispatch({ type: "errorChanged", message: "Complete the remaining admission steps before submitting your application." });
      return;
    }

    try {
      dispatch({ type: "submissionStarted" });
      const result = await submitAdmission(form, consent);
      dispatch({ type: "submitted", confirmation: result, index: visibleSteps.length - 1 });
    } catch (error) {
      dispatch({
        type: "submissionFailed",
        message: error instanceof Error
          ? error.message
          : "We could not submit your admission form right now. Please try again.",
      });
    }
  }

  function renderStep() {
    switch (currentStep.id) {
      case "applicant":
        return <ApplicantStep form={form} onChange={updateField} />;
      case "program":
        return <ProgramStep form={form} onChange={updateField} />;
      case "student":
      case "contact":
      case "lastSchool":
      case "guardian":
        return <DetailsStep stepId={currentStep.id} form={form} onChange={updateField} />;
      case "currentStudent":
        if (showingExistingStudentNotice && existingStudentNotice) {
          return (
            <div className="mx-auto flex h-full max-w-2xl items-center">
              <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                    <Check size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Record verified
                    </p>
                    <h3 className="mt-1 text-2xl font-bold text-gray-950">
                      Check your email for the update link.
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-gray-700">
                      {existingStudentNotice.message}
                    </p>
                    <p className="mt-4 text-sm leading-6 text-gray-600">
                      If you do not see the message right away, check your spam
                      or junk folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <CurrentStudentStep
            ref={currentStudentStepRef}
            form={form}
            onChange={updateField}
            onVerified={handleCurrentStudentVerified}
          />
        );
      case "review":
        return (
          <ReviewStep
            form={form}
            consent={consent}
            onConsentChange={(value) => dispatch({ type: "consentChanged", value })}
          />
        );
      default:
        return null;
    }
  }

  return (
    <section id="admission-form" className="relative z-10 bg-gray-50 pb-16">
      <div className="mx-auto -mt-12 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[290px_1fr]">
          <aside className="rounded-lg bg-white p-4 shadow-sm sm:border sm:border-gray-200 sm:p-0">
            <div className="sm:border-b sm:border-gray-200 sm:p-5">
              <div className="flex items-start justify-between gap-4 sm:block">
                <div>
                  <p className="text-sm font-semibold text-gray-500">
                    Admission progress
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-950 sm:mt-2 sm:text-2xl">
                    {safeCurrentIndex + 1}/{visibleSteps.length}
                  </p>
                </div>
                <p className="max-w-40 text-right text-sm font-semibold text-primary sm:hidden">
                  {currentStep.title}
                </p>
              </div>

              <div className="mt-4 sm:hidden">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-gray-200"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${
                        ((safeCurrentIndex + 1) / visibleSteps.length) * 100
                      }%`,
                    }}
                  />
                </div>
                <ol
                  className="mt-3 flex items-center justify-between gap-1"
                  aria-label="Admission steps"
                >
                  {visibleSteps.map((step, index) => {
                    const active = index === safeCurrentIndex;
                    const complete = stepIsComplete(step.id, form, consent);

                    return (
                      <li
                        key={step.id}
                        className={cn(
                          "h-1.5 flex-1 rounded-full",
                          active || complete ? "bg-primary" : "bg-gray-200"
                        )}
                        aria-current={active ? "step" : undefined}
                      >
                        <span className="sr-only">
                          {step.label}
                          {active
                            ? ", current step"
                            : complete
                              ? ", complete"
                              : ""}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>

            <ol className="hidden gap-1 p-3 sm:grid">
              {visibleSteps.map((step, index) => {
                const Icon = step.icon;
                const active = index === safeCurrentIndex;
                const complete = stepIsComplete(step.id, form, consent);
                const canNavigate = canNavigateToStep(index);

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (canNavigate) {
                          dispatch({ type: "navigated", index });
                        }
                      }}
                      disabled={
                        !canNavigate ||
                        submissionStatus === "submitting" ||
                        Boolean(confirmation) ||
                        showingExistingStudentNotice
                      }
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

            <div className="hidden border-t border-gray-200 p-5 sm:block">
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
            <StepHeader
              step={currentStep}
              currentIndex={safeCurrentIndex}
              totalSteps={visibleSteps.length}
            />

            <div className="min-h-140 px-5 py-6 sm:px-7">
              {confirmation ? (
                <AdmissionConfirmationView confirmation={confirmation} />
              ) : (
                renderStep()
              )}
            </div>

            <div className="flex flex-col gap-4 border-t border-gray-200 bg-gray-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              {submissionError ? (
                <p className="text-sm font-medium text-red-700">
                  {submissionError}
                </p>
              ) : showingExistingStudentNotice ? (
                <p className="text-sm font-medium text-emerald-700">
                  Your record was verified. Check your email inbox or spam
                  folder for the secure update link.
                </p>
              ) : !confirmation && !currentStepComplete ? (
                <p className="text-sm font-medium text-secondary">
                  {currentStep.id === "currentStudent" &&
                  currentStudentInputsComplete(form)
                    ? "Continue will verify your student record before you can proceed."
                    : currentStep.id === "review"
                      ? "Review the application details and provide consent before submitting."
                      : "Complete the required fields to continue."}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 sm:ml-auto sm:flex-row">
                <button
                  type="button"
                  onClick={confirmation || showingExistingStudentNotice ? resetWizard : goBack}
                  disabled={
                    submissionStatus === "submitting" ||
                    (!(confirmation || showingExistingStudentNotice) && isFirstStep)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmation || showingExistingStudentNotice ? (
                    <>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Start another application
                    </>
                  ) : (
                    <>
                      <ArrowLeft size={16} aria-hidden="true" />
                      Back
                    </>
                  )}
                </button>

                {!confirmation && !showingExistingStudentNotice && !existingStudentFlow && isLastStep ? (
                  <button
                    type="submit"
                    disabled={!formComplete || submissionStatus === "submitting"}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-secondary px-5 text-sm font-semibold text-white transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submissionStatus === "submitting"
                      ? "Submitting..."
                      : "Submit for Review"}
                    <Send size={16} aria-hidden="true" />
                  </button>
                ) : !confirmation ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={
                      !currentStepReadyToContinue ||
                      verifyingCurrentStudent ||
                      submissionStatus === "submitting"
                    }
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {verifyingCurrentStudent ? "Verifying record..." : "Continue"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
