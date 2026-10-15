"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import type { SubjectOverview } from "@/lib/subjects/admin";

const columns: InteractiveTableColumn<SubjectOverview>[] = [
  { header: "Subject", sortValue: (subject) => subject.name, cell: (subject) => <p className="font-semibold">{subject.name}</p> },
  { header: "Code", sortValue: (subject) => subject.code ?? "", cell: (subject) => subject.code ?? <span className="text-muted-foreground">Not set</span> },
  { header: "Units", sortValue: (subject) => subject.units === null ? -1 : Number(subject.units), cell: (subject) => subject.units ?? <span className="text-muted-foreground">Not set</span> },
  { header: "Programs", sortValue: (subject) => subject.programCount, cell: (subject) => subject.programCount },
  { header: "Classes", sortValue: (subject) => subject.classCount, cell: (subject) => subject.classCount },
  { header: "Actions", cell: (subject) => <Link href={`/portal/subjects/${subject.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit ${subject.name}`}><Pencil className="size-4" aria-hidden="true" />Edit</Link> },
];

function searchValue(subject: SubjectOverview) {
  return [subject.name, subject.code ?? "", subject.units ?? "", subject.programCount, subject.classCount].join(" ");
}

export function SubjectsTable({ subjects }: { subjects: SubjectOverview[] }) {
  return <InteractivePortalTable
    rows={subjects} columns={columns} rowKey={(subject) => subject.id} searchValue={searchValue}
    searchLabel="Search subjects" searchPlaceholder="Search subject name or code..."
    initialSort={{ column: "Subject", direction: "asc" }} rowLabel="subjects" emptyTitle="No subjects found"
    className="min-w-160"
  />;
}
