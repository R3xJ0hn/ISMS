"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { useActionToast } from "@/components/portal/toasts";
import { Button } from "@/components/ui/button";
import type { LastSchoolFormState, LastSchoolTableRow } from "@/lib/last-schools/types";
import { formatDate } from "@/lib/utils";
import { reviewLastSchoolAction } from "./actions";

const initialState: LastSchoolFormState = { success: false, message: "" };
const statuses = {
  pending: { label: "Pending", color: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  verified: { label: "Verified", color: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  rejected: { label: "Rejected", color: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200" },
} as const;

function SchoolReviewActions({ school }: { school: LastSchoolTableRow }) {
  const [state, formAction, pending] = useActionState(reviewLastSchoolAction, initialState);
  const router = useRouter();
  useActionToast(state);
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return (
    <form action={formAction} className="flex items-center gap-2" aria-busy={pending} aria-label={`Review ${school.schoolName || "unnamed school"}`}>
      <input type="hidden" name="schoolId" value={school.id} />
      <Button type="submit" name="decision" value="verify" variant="outline" size="sm" disabled={pending || state.success}
        aria-label={`Verify ${school.schoolName || "school"}`}><Check aria-hidden="true" />{pending ? "Saving..." : "Verify"}</Button>
      {school.verificationStatus === "pending" && <Button type="submit" name="decision" value="reject" variant="outline" size="sm" disabled={pending || state.success}
        aria-label={`Reject ${school.schoolName || "school"}`}><X aria-hidden="true" />Reject</Button>}
    </form>
  );
}

const columns: InteractiveTableColumn<LastSchoolTableRow>[] = [
  { header: "School", sortValue: (school) => school.schoolName, cell: (school) => <div className="max-w-64 whitespace-normal"><p className="font-semibold">{school.schoolName || "Unnamed school"}</p>{school.shortName && <p className="mt-1 text-xs text-muted-foreground">{school.shortName}</p>}</div> },
  { header: "Type", sortValue: (school) => school.schoolType, cell: (school) => school.schoolType },
  { header: "Address", sortValue: (school) => school.formattedAddress, cell: (school) => <p className="max-w-72 whitespace-normal">{school.formattedAddress || <span className="text-muted-foreground">Not provided</span>}</p> },
  { header: "Status", sortValue: (school) => statuses[school.verificationStatus].label, cell: (school) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statuses[school.verificationStatus].color}`}>{statuses[school.verificationStatus].label}</span> },
  { header: "Admissions", sortValue: (school) => school.applicationCount, cell: (school) => school.applicationCount },
  { header: "Added", sortValue: (school) => school.createdAt, cell: (school) => formatDate(new Date(school.createdAt)) },
  { header: "Actions", cell: (school) => <div className="flex flex-wrap items-center gap-3">
    <Link href={`/portal/last-schools/${school.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit ${school.schoolName || "school"}`}><Pencil className="size-4" aria-hidden="true" />Edit</Link>
    {school.verificationStatus !== "verified" && <SchoolReviewActions key={`${school.id}:${school.verificationStatus}`} school={school} />}
  </div> },
];

function searchValue(school: LastSchoolTableRow) {
  return [school.schoolName, school.shortName, school.schoolType, school.formattedAddress, statuses[school.verificationStatus].label].join(" ");
}

export function LastSchoolsTable({ schools }: { schools: LastSchoolTableRow[] }) {
  const [status, setStatus] = useState("");
  const filterId = useId();
  const filtered = schools.filter((school) => !status || school.verificationStatus === status);
  return <InteractivePortalTable key={status} rows={filtered} columns={columns} rowKey={(school) => school.id} searchValue={searchValue}
    searchLabel="Search last schools" searchPlaceholder="Search school, type, or address..."
    initialSort={{ column: "School", direction: "asc" }} rowLabel="schools" emptyTitle={status ? "No schools with this status" : "No schools added"}
    className="min-w-240"
    toolbarControls={<div className="flex flex-wrap items-center gap-2">
      <label htmlFor={filterId} className="text-sm text-muted-foreground">Status</label>
      <select id={filterId} value={status} onChange={(event) => setStatus(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <option value="">All schools</option>
        {Object.entries(statuses).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
      </select>
    </div>}
  />;
}
