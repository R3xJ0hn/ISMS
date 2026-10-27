"use client";

// Shared by authorized admin and teacher class views.
import { useId, useState } from "react";
import { Tabs } from "radix-ui";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { StudentIdentity } from "@/components/portal/student-identity";
import type { ClassRosterComparison, CrossMatchIssue, DatabaseRosterStudent } from "@/lib/classes/roster-cross-match";

const issueLabels: Record<CrossMatchIssue, string> = {
  missing_number: "Missing student number",
  missing_name: "Missing name",
  duplicate_number: "Duplicate student number",
  duplicate_name: "Duplicate name in sheet",
  ambiguous_database: "Multiple database matches",
  not_found: "Not found in database",
  name_mismatch: "Name differs",
  not_enrolled: "Not enrolled in this class",
};

type ComparisonRow = ClassRosterComparison["rows"][number];
type ProfileImage = { id: string; imageUrl: string | null };

function comparisonColumns(images: ReadonlyMap<string, string | null>): InteractiveTableColumn<ComparisonRow>[] {
  return [
  { header: "Sheet row", sortValue: (row) => row.rowNumber, cell: (row) => <span className="font-mono text-xs">{row.rowNumber}</span> },
  { header: "Student number", sortValue: (row) => row.studentNumber, cell: (row) => row.studentNumber || "Missing" },
  { header: "Google Sheet name", sortValue: (row) => row.sheetName, className: "min-w-48 whitespace-normal", cell: (row) => row.sheetName || "Missing" },
  { header: "Database name", sortValue: (row) => row.databaseName ?? "", className: "min-w-60 whitespace-normal", cell: (row) => row.databaseId && row.databaseName !== null ? (
    <StudentIdentity id={row.databaseId} name={row.databaseName || "Name not set"} imageUrl={images.get(row.databaseId)} />
  ) : "No unique match" },
  { header: "Class enrollment", sortValue: (row) => row.enrolled, cell: (row) => row.databaseId ? (row.enrolled ? "Enrolled" : "Not enrolled") : "Unresolved" },
  { header: "Result", sortValue: (row) => row.issues.length ? row.issues.map((issue) => issueLabels[issue]).join(" ") : "Matched", className: "min-w-60 whitespace-normal", cell: (row) => (
    row.issues.length ? <ul className="space-y-1 text-xs">{row.issues.map((issue) => <li key={issue} className={`w-fit rounded-md border px-2 py-1 ${issue === "name_mismatch" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-800"}`}>{issueLabels[issue]}</li>)}</ul>
      : <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">Matched</span>
  ) },
  ];
}

function missingColumns(images: ReadonlyMap<string, string | null>): InteractiveTableColumn<DatabaseRosterStudent>[] {
  return [
  { header: "Student number", sortValue: (student) => student.studentNumber ?? "", cell: (student) => student.studentNumber || <span className="text-red-700">Not assigned</span> },
  { header: "Name", sortValue: (student) => student.name, className: "min-w-60 whitespace-normal", cell: (student) => <StudentIdentity id={student.id} name={student.name} imageUrl={images.get(student.id)} /> },
  ];
}

export function RosterCrossMatchTable({ comparison, profiles = [] }: { comparison: ClassRosterComparison; profiles?: readonly ProfileImage[] }) {
  const filterId = useId();
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState("sheet");
  const images = new Map<string, string | null>();
  const duplicateIds = new Set<string>();
  for (const profile of profiles) {
    if (duplicateIds.has(profile.id)) continue;
    if (images.has(profile.id)) { images.delete(profile.id); duplicateIds.add(profile.id); }
    else images.set(profile.id, profile.imageUrl);
  }
  const triggerClassName = "shrink-0 border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:text-primary";
  const panelClassName = "min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=inactive]:hidden";
  const rows = comparison.rows.filter((row) => !filter || (filter === "matched" ? !row.issues.length
    : filter === "review" ? row.issues.length > 0 : row.issues.includes(filter as CrossMatchIssue)));

  return (
    <Tabs.Root value={tab} onValueChange={setTab} className="min-w-0 space-y-5">
      <Tabs.List aria-label="Cross-match student lists" className="flex min-w-0 overflow-x-auto border-b border-border">
        <Tabs.Trigger value="sheet" className={triggerClassName}>Google Sheet students ({comparison.rows.length})</Tabs.Trigger>
        <Tabs.Trigger value="missing" className={triggerClassName}>Missing from sheet <span className={comparison.missingStudents.length ? "text-red-700" : undefined}>({comparison.missingStudents.length})</span></Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="sheet" forceMount className={panelClassName}>
      <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby={`${filterId}-sheet-heading`}>
        <div className="border-b border-border p-4 sm:p-5">
          <h2 id={`${filterId}-sheet-heading`} className="font-semibold">Google Sheet students</h2>
          <p className="mt-1 text-sm text-muted-foreground">Student numbers determine the match. Names use the format Last name, First name Middle name. Only first and last names are checked; middle names are ignored.</p>
        </div>
        <InteractivePortalTable rows={rows} columns={comparisonColumns(images)} rowKey={(row) => String(row.rowNumber)}
          searchValue={(row) => `${row.rowNumber} ${row.studentNumber} ${row.sheetName} ${row.databaseName ?? ""} ${row.issues.map((issue) => issueLabels[issue]).join(" ")}`}
          searchLabel="Search spreadsheet comparison" searchPlaceholder="Search student number or name..."
          rowLabel="sheet rows" emptyTitle={comparison.rows.length ? "No sheet rows match these filters" : "No students found in the Google Sheet"}
          resetKey={filter} initialSort={{ column: "Sheet row", direction: "asc" }} className="min-w-220"
          toolbarControls={<div className="w-full sm:w-64">
            <label htmlFor={filterId} className="sr-only">Filter comparison results</label>
            <select id={filterId} value={filter} onChange={(event) => setFilter(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All results</option><option value="review">Needs review</option><option value="matched">Matched</option>
              {Object.entries(issueLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>}
        />
      </section>
      </Tabs.Content>
      <Tabs.Content value="missing" forceMount className={panelClassName}>
      <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby={`${filterId}-missing-heading`}>
        <div className="border-b border-border p-4 sm:p-5">
          <h2 id={`${filterId}-missing-heading`} className="font-semibold">Enrolled students missing from the sheet <span className={comparison.missingStudents.length ? "text-red-700" : "text-muted-foreground"}>({comparison.missingStudents.length})</span></h2>
          <p className="mt-1 text-sm text-muted-foreground">These saved class members have no student number in the sheet roster, or have no student number assigned.</p>
        </div>
        <InteractivePortalTable rows={comparison.missingStudents} columns={missingColumns(images)} rowKey={(student) => student.id}
          searchValue={(student) => `${student.name} ${student.studentNumber ?? ""}`}
          searchLabel="Search students missing from sheet" searchPlaceholder="Search name or student number..." rowLabel="students"
          initialSort={{ column: "Name", direction: "asc" }} emptyTitle="No enrolled students are missing from the sheet" />
      </section>
      </Tabs.Content>
    </Tabs.Root>
  );
}
