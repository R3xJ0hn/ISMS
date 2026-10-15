"use client";

import Link from "next/link";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import type { EmployeeStatus } from "@/lib/generated/prisma/enums";
import { TeacherSetupEmailForm } from "./teacher-invitation-form";

export type TeacherTableRow = {
  employeeRecordId: string;
  employeeId: string;
  fullName: string;
  emailAddress: string;
  contactNumber: string;
  status: EmployeeStatus;
  accountStatus: "Not Activated" | "Setup Email Sent" | "Setup Expired" | "Active" | "Account Conflict";
  invitationCreatedAt: string | null;
};

const columns: InteractiveTableColumn<TeacherTableRow>[] = [
  { header: "Employee ID", sortValue: (teacher) => teacher.employeeId, cell: (teacher) => teacher.employeeId },
  { header: "Name", sortValue: (teacher) => teacher.fullName, cell: (teacher) => <p className="font-semibold">{teacher.fullName}</p> },
  { header: "Email", sortValue: (teacher) => teacher.emailAddress, className: "break-all", cell: (teacher) => teacher.emailAddress },
  { header: "Employee status", sortValue: (teacher) => teacher.status, cell: (teacher) => teacher.status },
  { header: "Account status", sortValue: (teacher) => teacher.accountStatus, cell: (teacher) => teacher.accountStatus },
  { header: "Actions", cell: (teacher) => (
    <div className="flex flex-wrap items-center gap-3">
      {teacher.status !== "Resigned" && teacher.accountStatus !== "Active" && teacher.accountStatus !== "Account Conflict" && <TeacherSetupEmailForm teacher={teacher} compact />}
      <Link href={`/portal/employees/${teacher.employeeRecordId}/edit`} className="font-medium text-primary hover:underline" aria-label={`Edit employee ${teacher.fullName}`}>Edit employee</Link>
    </div>
  ) },
];

function searchValue(teacher: TeacherTableRow) {
  return [teacher.employeeId, teacher.fullName, teacher.emailAddress, teacher.contactNumber, teacher.status, teacher.accountStatus].join(" ");
}

export function TeachersTable({ teachers }: { teachers: TeacherTableRow[] }) {
  return (
    <InteractivePortalTable
      rows={teachers} columns={columns} rowKey={(teacher) => teacher.employeeRecordId} searchValue={searchValue}
      searchLabel="Search teachers" searchPlaceholder="Search employee ID, name, email, or status..."
      initialSort={{ column: "Name", direction: "asc" }} rowLabel="teachers" emptyTitle="No teacher employees yet"
      className="min-w-250"
    />
  );
}
