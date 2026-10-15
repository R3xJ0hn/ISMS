"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { formatProgramType } from "@/lib/utils";

export type ProgramTableRow = {
  id: string;
  label: string;
  code: string;
  programType: string;
  category: string;
  slug: string | null;
  listed: boolean;
  sortOrder: number;
  subjectCount: number;
};

const columns: InteractiveTableColumn<ProgramTableRow>[] = [
  { header: "Program", sortValue: (program) => program.label, cell: (program) => <Link href={`/portal/programs/${program.id}/subjects`} className="font-semibold text-primary hover:underline" aria-label={`Assign subjects to ${program.label}`}>{program.label}</Link> },
  { header: "Code", sortValue: (program) => program.code, cell: (program) => <Link href={`/portal/programs/${program.id}/subjects`} className="text-primary hover:underline">{program.code}</Link> },
  { header: "Subjects", sortValue: (program) => program.subjectCount, cell: (program) => <Link href={`/portal/programs/${program.id}/subjects`} className="text-primary hover:underline">{program.subjectCount}</Link> },
  { header: "Type", sortValue: (program) => formatProgramType(program.programType), cell: (program) => formatProgramType(program.programType) },
  { header: "Category", sortValue: (program) => program.category, cell: (program) => program.category },
  { header: "Public page", sortValue: (program) => program.listed, cell: (program) => program.listed
    ? <Link href={`/programs/${program.slug}`} className="text-primary underline underline-offset-4">View course</Link>
    : <span className="text-muted-foreground">Not listed</span> },
  { header: "Order", sortValue: (program) => program.sortOrder, cell: (program) => program.sortOrder },
  { header: "Actions", cell: (program) => <Link href={`/portal/programs/${program.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit ${program.label}`}><Pencil className="size-4" />Edit</Link> },
];

function searchValue(program: ProgramTableRow) {
  return [program.label, program.code, formatProgramType(program.programType), program.category,
    program.slug ?? "", program.listed ? "View course Listed" : "Not listed", program.sortOrder].join(" ");
}

export function ProgramsTable({ programs }: { programs: ProgramTableRow[] }) {
  return <InteractivePortalTable
    rows={programs} columns={columns} rowKey={(program) => program.id} searchValue={searchValue}
    searchLabel="Search programs" searchPlaceholder="Search name, code, type, or category..."
    initialSort={{ column: "Order", direction: "asc" }} rowLabel="programs" emptyTitle="No programs found"
    className="min-w-225"
  />;
}
