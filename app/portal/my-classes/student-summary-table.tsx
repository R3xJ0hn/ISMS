"use client";

import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import type { ClassSummaryStudent } from "@/lib/classes/spreadsheet";

const gradeFields = [
  ["Prelim", "prelim"], ["Midterm", "midterm"], ["Prefinals", "prefinals"],
  ["Finals", "finals"], ["Average", "average"],
] as const;

const columns: InteractiveTableColumn<ClassSummaryStudent>[] = [
  { header: "Student number", sortValue: (row) => row.studentNumber || null, cell: (row) => row.studentNumber || "Not assigned" },
  { header: "Student name", sortValue: (row) => row.studentName, cell: (row) => <span className="font-semibold">{row.studentName}</span> },
  ...gradeFields.map(([header, field]): InteractiveTableColumn<ClassSummaryStudent> => ({
    header,
    className: "text-right tabular-nums",
    sortValue: (row) => {
      const value = row[field];
      if (value === null || !value.trim()) return null;
      const number = Number(value.replace(/,/g, ""));
      return Number.isFinite(number) ? number : value;
    },
    cell: (row) => row[field] ?? "—",
  })),
  { header: "Remarks", sortValue: (row) => row.remarks, cell: (row) => row.remarks ?? "—" },
  { header: "Note", cell: (row) => row.note ?? "—" },
];

function searchValue(row: ClassSummaryStudent) {
  return [row.studentNumber, row.studentName, row.remarks, row.note].filter(Boolean).join(" ");
}

export function StudentSummaryTable({ students }: { students: ClassSummaryStudent[] }) {
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
