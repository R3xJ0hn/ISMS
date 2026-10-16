"use client";

import Link from "next/link";
import { Eye, Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { studentColumns } from "@/components/portal/student-columns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatAcademicLevel } from "@/lib/academic-levels";
import { formatStudentName, getInitials } from "@/lib/utils";
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
    userImage?: string | null;
  };
};

const columns: InteractiveTableColumn<StudentTableRow>[] = [
  { header: "Photo", className: "w-16", cell: (row) => (
    <Avatar className="size-10">
      <AvatarImage src={row.student.userImage ?? undefined} alt={`Profile photo for ${formatStudentName(row.student)}`} className="object-cover" />
      <AvatarFallback>{getInitials(formatStudentName(row.student))}</AvatarFallback>
    </Avatar>
  ) },
  { ...studentColumns.studentNumber, className: "whitespace-nowrap text-muted-foreground", sortValue: (row) => row.student.studentNumber },
  { ...studentColumns.student, className: "min-w-48", sortValue: (row) => formatStudentName(row.student) },
  { ...studentColumns.program, className: "min-w-44", sortValue: (row) => row.program.label + " " + formatAcademicLevel(row.academicLevel) },
  { header: "Branch", className: "text-muted-foreground", sortValue: (row) => row.branch.title, cell: (row) => row.branch.title },
  { ...studentColumns.contact, className: "max-w-64 break-all", sortValue: (row) => row.student.email },
  { header: "Approved", className: "whitespace-nowrap text-muted-foreground", sortValue: (row) => Date.parse(row.updatedAt), cell: (row) => row.approvedDate },
  { header: "Actions", className: "w-1 whitespace-nowrap", cell: (row) => (
    <div className="flex items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/portal/students/${row.id}`} aria-label={`View details for ${formatStudentName(row.student)}`}>
          <Eye aria-hidden="true" />View details
        </Link>
      </Button>
      <Button asChild variant="outline" size="sm">
        <Link href={`/portal/students/${row.id}/edit`} aria-label={`Edit ${formatStudentName(row.student)}`}>
          <Pencil aria-hidden="true" />Edit
        </Link>
      </Button>
    </div>
  ) },
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
