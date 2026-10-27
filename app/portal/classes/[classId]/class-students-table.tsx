"use client";

import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { StudentIdentity } from "@/components/portal/student-identity";
import { usePortalToast } from "@/components/portal/toasts";
import { Button } from "@/components/ui/button";
import type { EnrolledClassStudent } from "@/lib/classes/enrolled-grades";
import type { ClassGradeExportDetails } from "@/lib/classes/grade-export";
import { classGradeFields, getClassGradeSortValue } from "@/lib/classes/presentation";
import { ChevronDown, Download, FileSpreadsheet } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef, useState } from "react";

export type ManagedClassStudent = Omit<EnrolledClassStudent, "grades"> & { grades?: EnrolledClassStudent["grades"] };

function studentColumns(gradeAvailability: string): InteractiveTableColumn<ManagedClassStudent>[] {
  return [
  { header: "Student number", sortValue: (student) => student.studentNumber ?? "", cell: (student) => student.studentNumber || "Not assigned" },
  { header: "Name", sortValue: (student) => student.name, className: "min-w-60 whitespace-normal", cell: (student) => (
    <StudentIdentity id={student.id} name={student.name} imageUrl={student.imageUrl} />
  ) },
  ...classGradeFields.map(([header, field]): InteractiveTableColumn<ManagedClassStudent> => ({
    header: field === "average" ? "Final average" : header,
    className: `text-right tabular-nums${field === "average" ? " bg-muted/40 font-semibold" : ""}`,
    sortValue: (student) => getClassGradeSortValue(student.grades?.[field], true),
    cell: (student) => student.grades?.[field]?.trim() || "—",
  })),
  { header: "Remarks", className: "min-w-48 whitespace-normal", sortValue: (student) => student.grades?.remarks ?? null,
    cell: (student) => student.grades ? student.grades.remarks || "—" : (
      <span className="text-xs text-muted-foreground">{gradeAvailability === "Available" ? "No matching grade record" : "Grades unavailable"}</span>
    ) },
  ];
}

export function ClassStudentsTable({ students, gradeAvailability = "Unavailable", exportDetails }: {
  students: ManagedClassStudent[];
  gradeAvailability?: string;
  exportDetails?: ClassGradeExportDetails;
}) {
  const notify = usePortalToast();
  const exportingRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  async function exportExcel() {
    if (exportingRef.current || !students.length || !exportDetails) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const [exporter, XLSX] = await Promise.all([import("@/lib/classes/grade-export"), import("xlsx")]);
      const workbook = exporter.createClassGradesWorkbook(exportDetails, students.map((student) => ({ ...student, grades: student.grades ?? null })));
      XLSX.writeFile(workbook, exporter.classGradesExportFilename(exportDetails.classCode), { bookType: "xlsx", compression: true });
    } catch {
      notify("Unable to export class grades right now. Please try again.", "error");
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }

  return <InteractivePortalTable rows={students} columns={studentColumns(gradeAvailability)} rowKey={(student) => student.id}
    searchValue={(student) => `${student.name} ${student.studentNumber ?? ""} ${student.grades?.remarks ?? ""}`}
    searchLabel="Search enrolled students" searchPlaceholder="Search name or student number..."
    initialSort={{ column: "Name", direction: "asc" }} rowLabel="students" emptyTitle="No students enrolled in this class" className="min-w-260"
    toolbarControls={<DropdownMenu.Root open={exportMenuOpen} onOpenChange={(open) => { if (!open || !exportingRef.current) setExportMenuOpen(open); }}>
      <DropdownMenu.Trigger asChild><Button type="button" variant="outline" disabled={!students.length || !exportDetails} aria-disabled={exporting || undefined} aria-busy={exporting} className="aria-disabled:opacity-50">
        <Download aria-hidden="true" />{exporting ? "Exporting..." : "Export"}<ChevronDown aria-hidden="true" />
      </Button></DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[80] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg">
        <DropdownMenu.Label className="px-3 py-2 text-xs text-muted-foreground">All enrolled students ({students.length})</DropdownMenu.Label>
        <DropdownMenu.Item onSelect={exportExcel} disabled={exporting} className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none focus:bg-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
          <FileSpreadsheet aria-hidden="true" className="size-4" />Excel (.xlsx)
        </DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>} />;
}
