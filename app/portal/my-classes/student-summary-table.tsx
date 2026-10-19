"use client";

import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { StudentIdentity } from "@/components/portal/student-identity";
import type { ClassSummaryStudent } from "@/lib/classes/spreadsheet";
import { matchClassStudentProfiles, type ClassRosterProfile } from "@/lib/classes/student-preview";
import { classGradeFields, getClassGradeSortValue } from "@/lib/classes/presentation";

function summaryColumns(profiles: ReadonlyMap<string, ClassRosterProfile>): InteractiveTableColumn<ClassSummaryStudent>[] {
  return [
    { header: "Student number", sortValue: (row) => row.studentNumber || null, cell: (row) => row.studentNumber || "Not assigned" },
    { header: "Student name", sortValue: (row) => row.studentName, className: "min-w-64 whitespace-normal", cell: (row) => {
      const profile = profiles.get(row.studentNumber.trim());
      return <StudentIdentity id={profile?.id ?? `sheet:${row.studentNumber || row.studentName}`} name={row.studentName} imageUrl={profile?.imageUrl} nameClassName="font-semibold" />;
    } },
    ...classGradeFields.map(([header, field]): InteractiveTableColumn<ClassSummaryStudent> => ({
      header,
      className: "text-right tabular-nums",
      sortValue: (row) => getClassGradeSortValue(row[field]),
      cell: (row) => row[field] ?? "—",
    })),
    { header: "Remarks", sortValue: (row) => row.remarks, cell: (row) => row.remarks ?? "—" },
    { header: "Note", cell: (row) => row.note ?? "—" },
  ];
}

function searchValue(row: ClassSummaryStudent) {
  return [row.studentNumber, row.studentName, row.remarks, row.note].filter(Boolean).join(" ");
}

export function StudentSummaryTable({ students, roster = [] }: { students: ClassSummaryStudent[]; roster?: ClassRosterProfile[] }) {
  const columns = summaryColumns(matchClassStudentProfiles(students, roster));
  return (
    <InteractivePortalTable
      rows={students} columns={columns}
      rowKey={(row) => row.studentNumber ? `number:${row.studentNumber}` : `name:${row.studentName.trim().toUpperCase().replace(/\s+/g, " ")}`}
      searchValue={searchValue}
      searchLabel="Search class students" searchPlaceholder="Search student number or name..."
      initialSort={{ column: "Student name", direction: "asc" }} rowLabel="students"
      emptyTitle="No student records yet" className="min-w-260"
    />
  );
}
