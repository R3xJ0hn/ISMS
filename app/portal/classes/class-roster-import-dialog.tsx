"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalToast } from "@/components/portal/toasts";
import { portalTheme } from "@/lib/portal/theme";
import {
  classRosterImportMaxRows,
  parseClassRosterWorkbook,
  type ClassRosterImportRow,
  type ClassRosterStudent,
} from "@/lib/classes/roster-import";

export function ClassRosterImportDialog({ students, selectedIds, disabled, onApply }: {
  students: readonly ClassRosterStudent[];
  selectedIds: readonly string[];
  disabled?: boolean;
  onApply: (studentIds: string[]) => void;
}) {
  const fileId = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ClassRosterImportRow[] | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const request = useRef(0);
  const notify = usePortalToast();
  const selected = new Set(selectedIds);
  const matched = rows?.filter((row) => row.studentId !== null) ?? [];
  const additions = [...new Set(matched.map((row) => row.studentId!))].filter((id) => !selected.has(id));
  const unresolved = (rows?.length ?? 0) - matched.length;
  const tooMany = new Set([...selectedIds, ...additions]).size > classRosterImportMaxRows;

  useEffect(() => () => { request.current++; }, []);

  function changeOpen(next: boolean) {
    request.current++;
    setOpen(next);
    setFile(null);
    setRows(null);
    setError("");
    setReading(false);
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    request.current++;
    setFile(event.target.files?.[0] ?? null);
    setRows(null);
    setError("");
    setReading(false);
  }

  async function readFile() {
    if (!file || reading || disabled) return;
    const current = ++request.current;
    setReading(true);
    setRows(null);
    setError("");
    try {
      const result = await parseClassRosterWorkbook(file, students);
      if (current !== request.current) return;
      if (result.success) setRows(result.rows);
      else setError(result.message);
    } catch {
      if (current === request.current) setError("We could not read this workbook. Choose an Excel file and try again.");
    } finally {
      if (current === request.current) setReading(false);
    }
  }

  function applyStudents() {
    if (disabled || reading || !additions.length || tooMany) return;
    onApply(additions);
    notify(`${additions.length} ${additions.length === 1 ? "student" : "students"} selected. Save the class to apply the roster.`, "success");
    changeOpen(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" disabled={disabled} className="shrink-0"><Upload aria-hidden="true" />Upload Excel</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content style={portalTheme} className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-border bg-background text-foreground shadow-xl outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold">Add class students from Excel</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">Use your workbook to select matching saved students for this class.</Dialog.Description>
            </div>
            <Dialog.Close asChild><Button type="button" variant="ghost" size="icon-sm" aria-label="Close Excel upload" className="shrink-0"><X aria-hidden="true" /></Button></Dialog.Close>
          </div>
          <div className="min-h-0 space-y-5 overflow-y-auto p-4 sm:p-5" aria-busy={reading}>
            <section aria-labelledby={`${fileId}-instructions`} className="space-y-3 rounded-lg border border-border bg-muted/40 p-4">
              <h3 id={`${fileId}-instructions`} className="font-medium">Excel format</h3>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Use the first worksheet. Put <strong className="text-foreground">Student Number</strong> and <strong className="text-foreground">Name</strong> in the first row.</li>
                <li>Format student numbers as <strong className="text-foreground">Text</strong> to keep leading zeros and letter casing.</li>
                <li>Use the full saved student name, including middle name and suffix when present. Names ignore capitalization and extra spaces.</li>
                <li>Choose an <strong className="text-foreground">.xlsx or .xls</strong> file, up to 5 MB and 1,000 student rows.</li>
              </ol>
              <div className="overflow-x-auto rounded-md border border-border bg-background">
                <table className="w-full text-left text-sm" aria-label="Example Excel format">
                  <thead className="bg-muted"><tr><th className="px-3 py-2 font-medium">Student Number</th><th className="px-3 py-2 font-medium">Name</th></tr></thead>
                  <tbody><tr><td className="px-3 py-2 font-mono">0007</td><td className="px-3 py-2">Ana Cruz</td></tr><tr><td className="px-3 py-2 font-mono">2026-0012</td><td className="px-3 py-2">Ben Reyes Santos</td></tr></tbody>
                </table>
              </div>
            </section>
            <div className="space-y-2">
              <label htmlFor={fileId} className="block text-sm font-medium">Excel file</label>
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                <Input id={fileId} type="file" accept=".xlsx,.xls" onChange={chooseFile} disabled={reading || disabled} aria-describedby={`${fileId}-hint${error ? ` ${fileId}-error` : ""}`} aria-invalid={Boolean(error)} className="min-w-0 flex-1 cursor-pointer file:mr-3" />
                <Button type="button" variant="outline" onClick={readFile} disabled={!file || reading || disabled}><FileSpreadsheet aria-hidden="true" />{reading ? "Reading..." : "Read file"}</Button>
              </div>
              <p id={`${fileId}-hint`} className="text-xs leading-5 text-muted-foreground">Review the matches, then add them to your selection. Save the class to apply the roster.</p>
              {error && <p id={`${fileId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
              {reading && <p role="status" className="text-sm text-muted-foreground">Reading your workbook...</p>}
            </div>
            {rows && <section className="space-y-3" aria-label="Excel student matches">
              <p role="status" className="text-sm font-medium">{additions.length} to add · {matched.length - additions.length} already selected · {unresolved} unresolved</p>
              <p className="text-sm text-muted-foreground">Only matched students are added. Existing selections are kept. Correct unresolved rows in Excel or select those students manually.</p>
              {tooMany && <p role="alert" className="text-sm text-destructive">A class can have up to 1,000 students. Reduce your selections before adding these matches.</p>}
              <div className="max-h-64 overflow-auto rounded-md border border-border">
                <table className="w-full min-w-128 text-left text-sm">
                  <caption className="sr-only">Workbook rows matched against saved students</caption>
                  <thead className="sticky top-0 bg-muted"><tr>{["Row", "Student Number", "Name", "Result"].map((heading) => <th key={heading} scope="col" className="px-3 py-2 font-medium">{heading}</th>)}</tr></thead>
                  <tbody>{rows.map((row) => <tr key={row.rowNumber} className="border-t border-border">
                    <td className="px-3 py-2 align-top text-muted-foreground">{row.rowNumber}</td>
                    <td className="max-w-48 break-words px-3 py-2 align-top font-mono">{row.studentNumber || "—"}</td>
                    <td className="max-w-64 break-words px-3 py-2 align-top">{row.name || "—"}</td>
                    <td className={`max-w-64 break-words px-3 py-2 align-top ${row.studentId ? "text-emerald-700" : "text-destructive"}`}>{row.studentId && selected.has(row.studentId) ? "Already selected" : row.message}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>}
          </div>
          <div className="flex flex-wrap justify-end gap-3 border-t border-border p-4 sm:p-5">
            <Dialog.Close asChild><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
            <Button type="button" onClick={applyStudents} disabled={disabled || reading || !additions.length || tooMany}>Add {additions.length} {additions.length === 1 ? "student" : "students"}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
