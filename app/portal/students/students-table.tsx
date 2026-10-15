"use client";

import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { studentColumns } from "@/components/portal/student-columns";
import { formatAcademicLevel } from "@/lib/academic-levels";
import { formatStudentName } from "@/lib/utils";
import type { AcademicLevel, ApplicantType } from "@/lib/generated/prisma/enums";

export type StudentTableRow = {
  id: string;
  applicantType: ApplicantType;
  updatedAt: string;
  approvedDate: string;
  branch: { title: string };
  academicLevel: AcademicLevel;
  program: { label: string };
  student: Parameters<typeof formatStudentName>[0] & {
    email: string;
    phone: string | null;
    studentNumber: string | null;
  };
};

const columns: InteractiveTableColumn<StudentTableRow>[] = [
  { ...studentColumns.studentNumber, className: "whitespace-nowrap text-muted-foreground", sortValue: (row) => row.student.studentNumber },
  { ...studentColumns.student, className: "min-w-48", sortValue: (row) => formatStudentName(row.student) },
  { ...studentColumns.program, className: "min-w-44", sortValue: (row) => row.program.label + " " + formatAcademicLevel(row.academicLevel) },
  { header: "Branch", className: "text-muted-foreground", sortValue: (row) => row.branch.title, cell: (row) => row.branch.title },
  { ...studentColumns.contact, className: "max-w-64 break-all", sortValue: (row) => row.student.email },
  { header: "Approved", className: "whitespace-nowrap text-muted-foreground", sortValue: (row) => Date.parse(row.updatedAt), cell: (row) => row.approvedDate },
];

function searchValue(row: StudentTableRow) {
  return [formatStudentName(row.student), row.student.studentNumber ?? "Pending", row.applicantType,
    row.program.label, formatAcademicLevel(row.academicLevel), row.branch.title,
    row.student.phone ?? "", row.student.email, row.approvedDate].join(" ");
}

export function StudentsTable({ students }: { students: StudentTableRow[] }) {
  return (
    <InteractivePortalTable
      rows={students} columns={columns} rowKey={(row) => row.id} searchValue={searchValue}
      searchLabel="Search students" searchPlaceholder="Search student number, name, program, branch, or contact..."
      initialSort={{ column: "Approved", direction: "desc" }} rowLabel="students" emptyTitle="No approved students yet"
      className="min-w-225" cellClassName="px-4 py-3 align-middle"
    />
  );
}
