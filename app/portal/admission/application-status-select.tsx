"use client";

import { useRef } from "react";

import { updateApplicationStatusAction } from "@/app/portal/admission/actions";

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

  return (
    <form ref={formRef} action={updateApplicationStatusAction}>
      <input type="hidden" name="applicationId" value={applicationId} />
      <select
        name="applicationStatus"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {statuses.map((option) => (
          <option key={option} value={option}>
            {formatStatusLabel(option)}
          </option>
        ))}
      </select>
    </form>
  );
}
