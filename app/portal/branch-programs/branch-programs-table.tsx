"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import type { ProgramType } from "@/lib/generated/prisma/enums";

export type BranchProgramsRow = {
  id: string;
  title: string;
  slug: string;
  programs: Array<{ id: string; code: string; label: string; programType: ProgramType }>;
};

const columns: InteractiveTableColumn<BranchProgramsRow>[] = [
  { header: "Branch", sortValue: (branch) => branch.title, cell: (branch) => <p className="font-semibold">{branch.title}</p> },
  { header: "Programs offered", sortValue: (branch) => branch.programs.length, cell: (branch) => branch.programs.length
    ? <div className="space-y-2"><p className="text-xs text-muted-foreground">{branch.programs.length} {branch.programs.length === 1 ? "program" : "programs"}</p><ul className="space-y-1">{branch.programs.map((program) => <li key={program.id}><span className="font-medium">{program.code}</span> <span className="text-muted-foreground">{program.label}</span></li>)}</ul></div>
    : <span className="text-muted-foreground">No programs assigned</span> },
  { header: "Actions", cell: (branch) => <Link href={`/portal/branch-programs/${branch.id}/edit`} aria-label={`Assign programs to ${branch.title}`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline"><Pencil className="size-4" aria-hidden="true" />Assign programs</Link> },
];

function searchValue(branch: BranchProgramsRow) {
  return [branch.title, branch.slug, ...branch.programs.flatMap((program) => [program.code, program.label])].join(" ");
}

export function BranchProgramsTable({ branches }: { branches: BranchProgramsRow[] }) {
  return <InteractivePortalTable rows={branches} columns={columns} rowKey={(branch) => branch.id} searchValue={searchValue}
    searchLabel="Search branch programs" searchPlaceholder="Search branches or programs..." rowLabel="branches"
    initialSort={{ column: "Branch", direction: "asc" }} emptyTitle="No branches found" className="min-w-160" />;
}
