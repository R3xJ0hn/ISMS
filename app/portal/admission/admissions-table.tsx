"use client";

import { useId, useMemo, useState } from "react";
import { AdmittedStudentActions } from "./admitted-student-actions";
import { AdmissionBranchFilter, ApplicationStatusSelect } from "./admission-controls";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { studentColumns } from "@/components/portal/student-columns";
import { formatAcademicLevel } from "@/lib/academic-levels";
import { ApplicationStatus, type AcademicLevel, type ApplicantType } from "@/lib/generated/prisma/enums";
import { formatStudentName } from "@/lib/utils";

export type AdmissionTableRow = {
  id: string;
  applicantType: ApplicantType;
  applicationStatus: ApplicationStatus;
  submittedAt: string | null;
  submittedDate: string;
  academicLevel: AcademicLevel;
  program: { label: string };
  student: Parameters<typeof formatStudentName>[0] & {
    email: string;
    phone: string | null;
    studentNumber: string | null;
  };
};

const applicationStatuses = [ApplicationStatus.reviewing, ApplicationStatus.approved, ApplicationStatus.rejected];
const filterStatuses = [ApplicationStatus.draft, ApplicationStatus.reviewing, ApplicationStatus.rejected];
const statusLabel = (status: ApplicationStatus) => status === ApplicationStatus.reviewing ? "Review" : status.charAt(0).toUpperCase() + status.slice(1);
const filterSelectClassName = "h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none";

const columns: InteractiveTableColumn<AdmissionTableRow>[] = [
  { ...studentColumns.student, className: "min-w-48", sortValue: (row) => formatStudentName(row.student) },
  { ...studentColumns.studentNumber, className: "whitespace-nowrap text-muted-foreground", sortValue: (row) => row.student.studentNumber },
  { ...studentColumns.program, className: "min-w-44", sortValue: (row) => `${row.program.label} ${formatAcademicLevel(row.academicLevel)}` },
  { ...studentColumns.contact, className: "max-w-64 break-all", sortValue: (row) => row.student.email },
  {
    header: "Status",
    sortValue: (row) => statusLabel(row.applicationStatus),
    cell: (row) => row.applicationStatus === ApplicationStatus.draft ? (
      <span className="inline-flex rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Draft</span>
    ) : (
      <ApplicationStatusSelect applicationId={row.id} status={row.applicationStatus} statuses={applicationStatuses} />
    ),
  },
  { header: "Submitted", className: "whitespace-nowrap text-muted-foreground", sortValue: (row) => row.submittedAt ? Date.parse(row.submittedAt) : null, cell: (row) => row.submittedDate },
  {
    header: "Actions", className: "w-1 whitespace-nowrap",
    cell: (row) => <AdmittedStudentActions student={{ applicationId: row.id, firstName: row.student.firstName, lastName: row.student.lastName }} />,
  },
];

function searchValue(row: AdmissionTableRow) {
  return [formatStudentName(row.student), row.student.studentNumber ?? "Pending", row.applicantType,
    row.program.label, formatAcademicLevel(row.academicLevel), row.student.phone ?? "Pending",
    row.student.email, statusLabel(row.applicationStatus), row.submittedDate].join(" ");
}

export function AdmissionsTable({ applications, branches, selectedBranchId }: {
  applications: AdmissionTableRow[];
  branches: Array<{ id: string; title: string }>;
  selectedBranchId: string;
}) {
  const statusId = useId();
  const applicantTypeId = useId();
  const [status, setStatus] = useState("");
  const [applicantType, setApplicantType] = useState("");
  const rows = useMemo(() => applications.filter((application) =>
    (!status || application.applicationStatus === status) && (!applicantType || application.applicantType === applicantType)
  ), [applications, status, applicantType]);

  return (
    <InteractivePortalTable
      key={`${selectedBranchId}:${status}:${applicantType}`} rows={rows} columns={columns} rowKey={(row) => row.id} searchValue={searchValue}
      searchLabel="Search admissions" searchPlaceholder="Search student number, name, program, or contact..."
      initialSort={{ column: "Submitted", direction: "desc" }} rowLabel="applications"
      emptyTitle={status || applicantType ? "No applications match these filters" : "No admission applications yet"}
      className="min-w-225" cellClassName="px-4 py-3 align-middle"
      toolbarControls={<div role="group" aria-label="Admission filters" className="flex w-full min-w-0 flex-wrap items-center gap-3 sm:w-auto">
        <AdmissionBranchFilter branches={branches} selectedBranchId={selectedBranchId} />
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <label htmlFor={applicantTypeId} className="shrink-0 text-sm font-medium">Applicant type</label>
          <select id={applicantTypeId} value={applicantType} onChange={(event) => setApplicantType(event.target.value)} className={filterSelectClassName}>
            <option value="">All applicants</option>
            <option value="new">New</option>
            <option value="existing">Existing</option>
          </select>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
          <label htmlFor={statusId} className="shrink-0 text-sm font-medium">Status</label>
          <select id={statusId} value={status} onChange={(event) => setStatus(event.target.value)} className={filterSelectClassName}>
            <option value="">All statuses</option>
            {filterStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select>
        </div>
      </div>}
    />
  );
}
