"use client";

import { useActionState, useOptimistic, useRef, useTransition } from "react";

import {
  updateApplicationStatusAction,
  type UpdateApplicationStatusState,
} from "@/app/portal/admission/actions";

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
      <select
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
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {formatStatusLabel(option)}
          </option>
        ))}
      </select>
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
