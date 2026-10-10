"use client";

import { useActionState, useOptimistic, useRef, useTransition } from "react";

import {
  updateApplicationStatusAction,
  type UpdateApplicationStatusState,
} from "@/app/portal/admission/actions";
import { AdmissionSelect } from "@/app/portal/admission/admission-ui";

type ApplicationStatusSelectProps = {
  applicationId: string;
  status: string;
  statuses: string[];
};

function formatStatusLabel(status: string) {
  if (status === "reviewing") {
    return "Review";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ApplicationStatusSelect({
  applicationId,
  status,
  statuses,
}: ApplicationStatusSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const errorId = `application-status-error-${applicationId}`;
  const [state, formAction, pending] = useActionState(
    updateApplicationStatusAction,
    {
      success: false,
      message: "",
      status,
    } satisfies UpdateApplicationStatusState
  );
  const committedStatus = state.success || state.message ? state.status : status;
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    committedStatus,
    (_currentStatus, nextStatus: string) => nextStatus
  );
  const [, startTransition] = useTransition();

  return (
    <form ref={formRef} action={formAction} className="space-y-1">
      <input type="hidden" name="applicationId" value={applicationId} />
      <AdmissionSelect
        name="applicationStatus"
        aria-label="Application status"
        aria-describedby={
          state.message && !state.success && !pending ? errorId : undefined
        }
        value={optimisticStatus}
        disabled={pending}
        onChange={(event) => {
          const nextStatus = event.target.value;

          startTransition(() => {
            setOptimisticStatus(nextStatus);
            requestAnimationFrame(() => formRef.current?.requestSubmit());
          });
        }}
        className="w-auto px-2"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {formatStatusLabel(option)}
          </option>
        ))}
      </AdmissionSelect>
      {pending ? (
        <p className="text-xs text-muted-foreground">Saving...</p>
      ) : state.message && !state.success ? (
        <p id={errorId} aria-live="polite" className="text-xs text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

type AdmissionBranchFilterProps = {
  branches: Array<{
    id: string;
    title: string;
  }>;
  selectedBranchId: string;
};

export function AdmissionBranchFilter({
  branches,
  selectedBranchId,
}: AdmissionBranchFilterProps) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action="/portal/admission" className="space-y-2">
      <label
        htmlFor="branch-filter"
        className="text-sm font-medium text-foreground"
      >
        Branch
      </label>
      <AdmissionSelect
        id="branch-filter"
        name="branchId"
        defaultValue={selectedBranchId}
        onChange={() => formRef.current?.requestSubmit()}
        className="w-auto min-w-60"
      >
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.title}
          </option>
        ))}
      </AdmissionSelect>
    </form>
  );
}

