"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function ApplicationStatusSelect({
  applicationId,
  status,
  statuses,
}: ApplicationStatusSelectProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [value, setValue] = useState(status);
  const [state, formAction, pending] = useActionState(
    updateApplicationStatusAction,
    {
      success: false,
      message: "",
      status,
    } satisfies UpdateApplicationStatusState
  );

  useEffect(() => {
    setValue(status);
  }, [status]);

  useEffect(() => {
    if (!state.status) {
      return;
    }

    setValue(state.status);
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-1">
      <input type="hidden" name="applicationId" value={applicationId} />
      <select
        name="applicationStatus"
        value={value}
        disabled={pending}
        onChange={(event) => {
          setValue(event.target.value);
          requestAnimationFrame(() => formRef.current?.requestSubmit());
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
        <p className="text-xs text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}
