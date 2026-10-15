"use client";

import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";

type RosterStudent = { id: string; name: string; studentNumber: string | null };
const columns: InteractiveTableColumn<RosterStudent>[] = [
  { header: "Student number", sortValue: (student) => student.studentNumber ?? "", cell: (student) => student.studentNumber ?? "Not assigned" },
  { header: "Name", sortValue: (student) => student.name, cell: (student) => student.name },
];

export function ClassRosterTable({ students }: { students: RosterStudent[] }) {
  return <InteractivePortalTable rows={students} columns={columns} rowKey={(student) => student.id} searchValue={(student) => student.name + " " + (student.studentNumber ?? "")}
    searchLabel="Search class roster" searchPlaceholder="Search name or student number..." rowLabel="students" emptyTitle="No students assigned yet" initialSort={{ column: "Name", direction: "asc" }} />;
}
