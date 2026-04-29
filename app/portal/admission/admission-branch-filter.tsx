"use client";

import { useRef } from "react";

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
      <select
        id="branch-filter"
        name="branchId"
        defaultValue={selectedBranchId}
        onChange={() => formRef.current?.requestSubmit()}
        className="h-9 min-w-60 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <option value="">All branches</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.title}
          </option>
        ))}
      </select>
    </form>
  );
}
