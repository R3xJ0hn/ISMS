"use client";

import { FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  bulkAdmitStudentsAction,
  type BulkAdmitStudentsState,
} from "@/app/portal/admission/actions";
import { Button } from "@/components/ui/button";

const initialState = {
  success: false,
  message: "",
} satisfies BulkAdmitStudentsState;

type BulkAdmitStudentsOptions = {
  branches: Array<{
    id: string;
    title: string;
  }>;
  programs: Array<{
    id: string;
    code: string;
    label: string;
    programType: string;
  }>;
  academicLevels: Array<{
    id: string;
    label: string;
  }>;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function BulkAdmitStudentsModal({
  options,
}: {
  options: BulkAdmitStudentsOptions;
}) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [showActionMessage, setShowActionMessage] = useState(false);
  const [state, formAction, pending] = useActionState(
    bulkAdmitStudentsAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    formRef.current?.reset();
    const resetTimer = window.setTimeout(() => {
      setFileName("");
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [state.success]);

  function openModal() {
    formRef.current?.reset();
    setFileName("");
    setShowActionMessage(false);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setShowActionMessage(false);
  }

  function handleFileSelection(file?: File) {
    setFileName(file?.name ?? "");
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openModal}>
        <FileSpreadsheet />
        Bulk Admit
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Bulk Admit Students
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the admission details, then upload an Excel file.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={closeModal}
                aria-label="Close"
              >
                <X />
              </Button>
            </div>

            <form
              ref={formRef}
              action={formAction}
              onSubmit={() => setShowActionMessage(true)}
              className="space-y-5 overflow-y-auto p-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Applicant type
                  </span>
                  <select name="applicantType" required className={selectClass}>
                    <option value="">Select applicant type</option>
                    <option value="new">New</option>
                    <option value="existing">Existing</option>
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Branch
                  </span>
                  <select name="branchId" required className={selectClass}>
                    <option value="">Select branch</option>
                    {options.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Program
                  </span>
                  <select name="programId" required className={selectClass}>
                    <option value="">Select program</option>
                    {options.programs.map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.code} - {program.label} ({program.programType})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Academic level
                  </span>
                  <select name="academicLevelsId" required className={selectClass}>
                    <option value="">Select academic level</option>
                    {options.academicLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label
                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:bg-muted/50"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const file = event.dataTransfer.files.item(0);

                  if (fileInputRef.current && file) {
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    fileInputRef.current.files = dataTransfer.files;
                    handleFileSelection(file);
                  }
                }}
              >
                <UploadCloud className="size-8 text-muted-foreground" />
                <span className="mt-3 text-sm font-medium text-foreground">
                  Drag the Excel file here or click to upload
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Required columns: Email Address, First Name, Last Name, Birth
                  date, Student Number
                </span>
                {fileName ? (
                  <span className="mt-3 rounded-md bg-background px-2 py-1 text-xs text-foreground">
                    {fileName}
                  </span>
                ) : null}
                <input
                  ref={fileInputRef}
                  name="studentsFile"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  required
                  className="sr-only"
                  onChange={(event) =>
                    handleFileSelection(event.currentTarget.files?.item(0) ?? undefined)
                  }
                />
              </label>

              {showActionMessage && state.message ? (
                <p
                  className={
                    state.success
                      ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700"
                      : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  }
                >
                  {state.message}
                </p>
              ) : null}

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={closeModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Importing..." : "Import Students"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
