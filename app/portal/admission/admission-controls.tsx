"use client";

import { useActionState, useOptimistic, useRef, useTransition } from "react";

import {
  updateApplicationStatusAction,
  type UpdateApplicationStatusState,
} from "@/app/portal/admission/actions";
import { AdmissionSelect } from "@/app/portal/admission/admission-ui";
import { useActionToast } from "@/components/portal/toasts";
import { getApplicationStatusLabel } from "@/lib/admission/status";

type ApplicationStatusSelectProps = {
  applicationId: string;
  status: string;
  statuses: string[];
};

export function ApplicationStatusSelect({
  applicationId,
  status,
  statuses,
}: ApplicationStatusSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    updateApplicationStatusAction,
    {
      success: false,
      message: "",
      status,
    } satisfies UpdateApplicationStatusState
  );
  useActionToast(state);
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
        aria-invalid={Boolean(state.message && !state.success && !pending)}
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
            {getApplicationStatusLabel(option)}
          </option>
        ))}
      </AdmissionSelect>
      {pending ? (
        <p className="text-xs text-muted-foreground">Saving...</p>
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
    <form ref={formRef} action="/portal/admission" method="get" className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <label
        htmlFor="branch-filter"
        className="shrink-0 text-sm font-medium text-foreground"
      >
        Branch
      </label>
      <AdmissionSelect
        id="branch-filter"
        name="branchId"
        defaultValue={selectedBranchId}
        onChange={() => formRef.current?.requestSubmit()}
        className="min-w-0 flex-1 sm:w-auto sm:max-w-64 sm:flex-none"
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

