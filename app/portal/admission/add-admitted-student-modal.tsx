"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  addAdmittedStudentAction,
  type AddAdmittedStudentState,
} from "@/app/portal/admission/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState = {
  success: false,
  message: "",
} satisfies AddAdmittedStudentState;

type AddAdmittedStudentOptions = {
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

export function AddAdmittedStudentModal({
  options,
}: {
  options: AddAdmittedStudentOptions;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addAdmittedStudentAction,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.success) {
      return;
    }

    formRef.current?.reset();
  }, [state.success]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus />
        Add Student
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Add Admitted Student
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enter the student details to add them to admissions.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X />
              </Button>
            </div>

            <form
              ref={formRef}
              action={formAction}
              className="space-y-4 overflow-y-auto p-5"
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

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Student number
                  </span>
                  <Input name="studentNumber" required />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Student email
                  </span>
                  <Input name="email" type="email" required />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    First name
                  </span>
                  <Input name="firstName" required />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">
                    Last name
                  </span>
                  <Input name="lastName" required />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-foreground">
                    Birth date
                  </span>
                  <Input name="birthDate" type="date" required />
                </label>

                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-foreground">
                    Gender
                  </span>
                  <select name="gender" required className={selectClass}>
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                  </select>
                </label>

              </div>

              {state.message ? (
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Adding..." : "Add to Admit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
