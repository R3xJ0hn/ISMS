"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { formatAcademicLevel, formatSemester } from "@/lib/academic-levels";
import type { AcademicLevel, Semester } from "@/lib/generated/prisma/enums";

export type ClassTableRow = {
  id: string;
  schoolYear: string;
  semester?: Semester | null;
  branchTitle: string | null;
  programLabel?: string | null;
  sectionName: string;
  yearLevel: AcademicLevel;
  subjectName: string;
  teacherEmail: string;
  teacherName?: string;
  studentCount?: number;
  spreadsheetLinked: boolean;
};

const columns: InteractiveTableColumn<ClassTableRow>[] = [
  { header: "Branch", sortValue: (classRecord) => classRecord.branchTitle ?? "", cell: (classRecord) => classRecord.branchTitle ?? <span className="text-muted-foreground">Not assigned</span> },
  { header: "Program", sortValue: (classRecord) => classRecord.programLabel ?? "", cell: (classRecord) => classRecord.programLabel ?? <span className="text-muted-foreground">Choose when editing</span> },
  { header: "School year", sortValue: (classRecord) => classRecord.schoolYear, cell: (classRecord) => classRecord.schoolYear },
  { header: "Semester", sortValue: (classRecord) => formatSemester(classRecord.semester), cell: (classRecord) => formatSemester(classRecord.semester) },
  { header: "Section", sortValue: (classRecord) => classRecord.sectionName, cell: (classRecord) => <p className="font-semibold">{classRecord.sectionName}</p> },
  { header: "Year level", sortValue: (classRecord) => formatAcademicLevel(classRecord.yearLevel), cell: (classRecord) => formatAcademicLevel(classRecord.yearLevel) },
  { header: "Subject", sortValue: (classRecord) => classRecord.subjectName, cell: (classRecord) => classRecord.subjectName },
  { header: "Teacher", sortValue: (classRecord) => classRecord.teacherName ?? classRecord.teacherEmail, className: "break-all", cell: (classRecord) => <div><p className="font-medium">{classRecord.teacherName ?? classRecord.teacherEmail}</p>{classRecord.teacherName && <p className="text-xs text-muted-foreground">{classRecord.teacherEmail}</p>}</div> },
  { header: "Students", sortValue: (classRecord) => classRecord.studentCount ?? 0, cell: (classRecord) => classRecord.studentCount ?? 0 },
  {
    header: "Spreadsheet",
    sortValue: (classRecord) => classRecord.spreadsheetLinked,
    cell: (classRecord) => <span className={classRecord.spreadsheetLinked ? "font-medium" : "text-muted-foreground"}>{classRecord.spreadsheetLinked ? "Linked" : "Not linked"}</span>,
  },
  {
    header: "Actions",
    cell: (classRecord) => (
      <Link href={`/portal/classes/${classRecord.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit ${classRecord.subjectName} for ${classRecord.sectionName}, ${classRecord.schoolYear}`}>
        <Pencil className="size-4" aria-hidden="true" />Edit
      </Link>
    ),
  },
];

function searchValue(classRecord: ClassTableRow) {
  return [classRecord.branchTitle ?? "Not assigned", classRecord.programLabel ?? "", classRecord.schoolYear, formatSemester(classRecord.semester), classRecord.sectionName, formatAcademicLevel(classRecord.yearLevel), classRecord.subjectName, classRecord.teacherName, classRecord.teacherEmail, classRecord.spreadsheetLinked ? "Linked" : "Not linked"].join(" ");
}

export function ClassesTable({ classes }: { classes: ClassTableRow[] }) {
  return (
    <InteractivePortalTable
      rows={classes} columns={columns} rowKey={(classRecord) => classRecord.id} searchValue={searchValue}
      searchLabel="Search classes" searchPlaceholder="Search branch, program, school year, semester, section, subject, or teacher..."
      initialSort={{ column: "School year", direction: "desc" }} rowLabel="classes" emptyTitle="No class assignments yet"
      className="min-w-275"
    />
  );
}
