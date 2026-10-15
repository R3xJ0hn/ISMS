"use client";

import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
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
  headingRef,
  headerRef,
}: {
  step: Step;
  currentIndex: number;
  totalSteps: number;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  headerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const Icon = step.icon;

  return (
    <div ref={headerRef} className="scroll-mt-24 rounded-t-lg border-b border-gray-200 px-4 py-4 sm:px-7 sm:py-5">
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">
        Step {currentIndex + 1} of {totalSteps} / {step.eyebrow}
      </p>
      <div className="mt-2 flex items-center gap-2.5 sm:gap-3">
        <Icon className="size-6 shrink-0 text-primary sm:size-7" aria-hidden="true" />
        <h2
          id="admission-step-heading"
          ref={headingRef}
          tabIndex={-1}
          className="min-w-0 text-xl font-bold tracking-tight text-gray-950 outline-none sm:text-2xl"
        >
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
  const stepHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  const stepHeaderRef = React.useRef<HTMLDivElement | null>(null);

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
  const viewKey = `${currentStep.id}:${confirmation ? "submitted" : showingExistingStudentNotice ? "verified" : "editing"}`;
  const previousViewRef = React.useRef(viewKey);

  React.useEffect(() => {
    if (previousViewRef.current === viewKey) return;
    previousViewRef.current = viewKey;

    const frame = window.requestAnimationFrame(() => {
      const heading = stepHeadingRef.current;
      heading?.focus({ preventScroll: true });
      stepHeaderRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [viewKey]);

  function canNavigateToStep(index: number) {
    if (index === safeCurrentIndex) {
      return true;
    }

    return visibleSteps
      .slice(0, index)
      .every((step) => stepIsComplete(step.id, form, consent));
  }

  function renderStepLinks(compact = false) {
    return visibleSteps.map((step, index) => {
      const Icon = step.icon;
      const active = index === safeCurrentIndex;
      const complete = stepIsComplete(step.id, form, consent);
      const canNavigate = canNavigateToStep(index);

      return (
        <li key={step.id}>
          <button
            type="button"
            aria-current={active ? "step" : undefined}
            onClick={(event) => {
              if (canNavigate) {
                dispatch({ type: "navigated", index });
                event.currentTarget.closest("details")?.removeAttribute("open");
                if (index === safeCurrentIndex) {
                  stepHeadingRef.current?.focus({ preventScroll: true });
                }
              }
            }}
            disabled={
              !canNavigate ||
              verifyingCurrentStudent ||
              submissionStatus === "submitting" ||
              Boolean(confirmation) ||
              showingExistingStudentNotice
            }
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/25",
              compact ? "min-h-12" : "min-h-14",
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
              ) : compact ? (
                <span className="text-sm font-semibold">{index + 1}</span>
              ) : (
                <Icon size={16} aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{step.label}</span>
              {!compact && (
                <span
                  className={cn(
                    "block text-xs",
                    active ? "text-white/80" : "text-gray-500"
                  )}
                >
                  {step.eyebrow}
                </span>
              )}
            </span>
          </button>
        </li>
      );
    });
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
              <div className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                    <Check size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Record verified
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-gray-950 sm:text-2xl">
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
    <section id="admission-form" className="relative z-10 bg-gray-50 pb-10 sm:pb-16">
      <div className="mx-auto -mt-6 w-full max-w-7xl px-3 sm:px-6 lg:-mt-12 lg:px-8">
        <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:gap-6">
          <aside className="min-w-0 rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="p-4 lg:border-b lg:border-gray-200 lg:p-5">
              <div className="flex items-center justify-between gap-3 lg:block">
                <div>
                  <p className="text-xs font-semibold text-gray-500 lg:text-sm">
                    Admission progress
                  </p>
                  <p className="mt-1 text-base font-bold text-gray-950 lg:mt-2 lg:text-2xl">
                    Step {safeCurrentIndex + 1} of {visibleSteps.length}
                  </p>
                </div>
                <details className="relative shrink-0 lg:hidden">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-md bg-gray-100 px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 [&::-webkit-details-marker]:hidden">
                    View steps
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <ol
                    className="absolute right-0 top-full z-30 mt-2 grid max-h-[60dvh] w-64 max-w-[calc(100vw-4rem)] gap-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
                    aria-label="Admission steps"
                  >
                    {renderStepLinks(true)}
                  </ol>
                </details>
              </div>

              <div className="mt-3 lg:hidden">
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-gray-200"
                  role="progressbar"
                  aria-label="Admission progress"
                  aria-valuemin={0}
                  aria-valuemax={visibleSteps.length}
                  aria-valuenow={safeCurrentIndex + 1}
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
              </div>
            </div>

            <ol className="hidden gap-1 p-3 lg:grid" aria-label="Admission steps">
              {renderStepLinks()}
            </ol>

            <div className="hidden border-t border-gray-200 p-5 lg:block">
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
            className="min-w-0 rounded-lg border border-gray-200 bg-white shadow-sm"
          >
            <StepHeader
              step={currentStep}
              currentIndex={safeCurrentIndex}
              totalSteps={visibleSteps.length}
              headingRef={stepHeadingRef}
              headerRef={stepHeaderRef}
            />

            {/* This boundary keeps sticky actions from covering the step header. */}
            <div className="min-w-0">
              <div className="px-4 py-5 sm:px-7 sm:py-6 lg:min-h-140">
                {confirmation ? (
                  <AdmissionConfirmationView confirmation={confirmation} />
                ) : (
                  renderStep()
                )}
              </div>

              <div className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-b-lg border-t border-gray-200 bg-gray-50 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5 lg:static">
                {submissionError ? (
                  <p role="alert" className="min-w-0 text-sm font-medium wrap-break-word text-red-700">
                    {submissionError}
                  </p>
                ) : !confirmation && !showingExistingStudentNotice && !currentStepComplete ? (
                  <p className="min-w-0 text-xs leading-5 font-medium text-secondary sm:text-sm">
                    {currentStep.id === "currentStudent" &&
                    currentStudentInputsComplete(form)
                      ? "Continue will verify your student record before you can proceed."
                      : currentStep.id === "review"
                        ? "Review the application details and provide consent before submitting."
                        : "Complete the required fields to continue."}
                  </p>
                ) : null}

                <div className={cn(
                  "grid w-full shrink-0 grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)] gap-2 sm:ml-auto sm:flex sm:w-auto sm:gap-3",
                  (isFirstStep || confirmation || showingExistingStudentNotice) && "grid-cols-1"
                )}>
                  <button
                    type="button"
                    onClick={confirmation || showingExistingStudentNotice ? resetWizard : goBack}
                    disabled={
                      verifyingCurrentStudent || submissionStatus === "submitting" ||
                      (!(confirmation || showingExistingStudentNotice) && isFirstStep)
                    }
                    className={cn(
                      "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:px-5",
                      isFirstStep && !confirmation && !showingExistingStudentNotice && "hidden sm:inline-flex"
                    )}
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
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold text-white transition hover:bg-secondary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:px-5"
                    >
                      {submissionStatus === "submitting"
                        ? "Submitting..."
                        : "Submit for Review"}
                      <Send size={16} aria-hidden="true" />
                    </button>
                  ) : !confirmation && !showingExistingStudentNotice ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={
                        !currentStepReadyToContinue ||
                        verifyingCurrentStudent ||
                        submissionStatus === "submitting"
                      }
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11 sm:px-5"
                    >
                      {verifyingCurrentStudent ? "Verifying record..." : "Continue"}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
