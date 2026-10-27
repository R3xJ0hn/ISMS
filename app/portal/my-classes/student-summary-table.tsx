"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { StudentIdentity } from "@/components/portal/student-identity";
import type { ClassSummaryStudent } from "@/lib/classes/spreadsheet";
import { matchClassStudentProfiles, type ClassRosterProfile } from "@/lib/classes/student-preview";
import { classGradeFields, getClassGradeSortValue } from "@/lib/classes/presentation";

function summaryColumns(profiles: ReadonlyMap<string, ClassRosterProfile>, classId: string): InteractiveTableColumn<ClassSummaryStudent>[] {
  return [
    { header: "Student number", sortValue: (row) => row.studentNumber || null, cell: (row) => row.studentNumber || "Not assigned" },
    { header: "Student name", sortValue: (row) => row.studentName, className: "min-w-72 max-w-sm whitespace-normal", cell: (row) => {
      const profile = profiles.get(row.studentNumber.trim());
      const identity = <StudentIdentity id={profile?.id ?? `sheet:${row.studentNumber || row.studentName}`} name={row.studentName} imageUrl={profile?.imageUrl} nameClassName="font-medium text-foreground" />;
      return profile ? (
        <Link href={`/portal/my-classes/${classId}/students/${profile.id}`}
          className="group -mx-2.5 -my-1.5 flex min-w-0 items-center gap-3 rounded-xl border border-transparent px-2.5 py-1.5 text-foreground transition-colors hover:border-border/70 hover:bg-muted/60 focus-visible:border-border focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
          aria-label={`View activity records for ${row.studentName}`} title="View activity records">
          <div className="min-w-0 flex-1">{identity}</div>
          <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground transition-colors group-hover:bg-background group-hover:text-foreground group-focus-visible:bg-background group-focus-visible:text-foreground motion-reduce:transition-none">
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none" />
          </span>
        </Link>
      ) : identity;
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

export function StudentSummaryTable({ classId, students, roster = [] }: { classId: string; students: ClassSummaryStudent[]; roster?: ClassRosterProfile[] }) {
  const columns = summaryColumns(matchClassStudentProfiles(students, roster), classId);
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
