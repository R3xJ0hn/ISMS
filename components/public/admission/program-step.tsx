"use client";

import type { ReactNode } from "react";
import * as React from "react";
import {
  AlertCircle,
  Building2,
  GraduationCap,
  Layers3,
  LoaderCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ProgramFieldName =
  | "program_type"
  | "program_id"
  | "program_code"
  | "program_label"
  | "academic_level_id"
  | "academic_level_label";

type ProgramFormValues = {
  branch_id: string;
  program_type: string;
  program_id: string;
  program_code: string;
  program_label: string;
  academic_level_id: string;
  academic_level_label: string;
};

type ProgramStepProps = {
  form: ProgramFormValues;
  onChange: (field: ProgramFieldName, value: string) => void;
};

type BranchSummary = {
  id: string;
  title: string;
  code: string;
};

type AcademicLevelOption = {
  id: string;
  label: string;
  slug: string;
};

type ProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: AcademicLevelOption[];
};

type ProgramOptionsResponse = {
  branch?: BranchSummary;
  programs?: ProgramOption[];
};

type ProgramOptionsStatus = "idle" | "loading" | "success" | "error";

const selectClass =
  "h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const programTypeLabels: Record<string, string> = {
  Bachelor: "Bachelor's Degree",
  SeniorHigh: "Senior High School",
  Associate: "Associate Degree",
};

const programTypeOrder = new Map(
  ["Bachelor", "SeniorHigh", "Associate"].map((value, index) => [value, index])
);

function formatProgramType(programType: string) {
  return programTypeLabels[programType] ?? programType;
}

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        {label}
        {required ? <span className="text-secondary"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs leading-5 text-gray-500">{hint}</p> : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  placeholder,
  required,
  disabled,
  hint,
  children,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label} required={required} hint={hint}>
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        aria-required={required}
        disabled={disabled}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          onChange(event.target.value);
        }}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(
            `Please ${label.toLowerCase()}.`
          );
        }}
        className={cn(
          selectClass,
          disabled && "cursor-not-allowed bg-gray-100 text-gray-500"
        )}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {children}
      </select>
    </Field>
  );
}

export default function ProgramStep({ form, onChange }: ProgramStepProps) {
  const [branch, setBranch] = React.useState<BranchSummary | null>(null);
  const [programs, setPrograms] = React.useState<ProgramOption[]>([]);
  const [status, setStatus] = React.useState<ProgramOptionsStatus>("idle");

  React.useEffect(() => {
    const controller = new AbortController();

    if (!form.branch_id) {
      setBranch(null);
      setPrograms([]);
      setStatus("idle");
      return () => controller.abort();
    }

    async function loadPrograms() {
      try {
        setStatus("loading");

        const response = await fetch(
          `/api/admissions/program-options?branchId=${encodeURIComponent(form.branch_id)}`,
          {
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch program options.");
        }

        const data = (await response.json()) as ProgramOptionsResponse;

        setBranch(data.branch ?? null);
        setPrograms(data.programs ?? []);
        setStatus("success");
      } catch {
        if (!controller.signal.aborted) {
          setBranch(null);
          setPrograms([]);
          setStatus("error");
        }
      }
    }

    void loadPrograms();

    return () => controller.abort();
  }, [form.branch_id]);

  const availableProgramTypes = React.useMemo(
    () =>
      Array.from(new Set(programs.map((program) => program.programType)))
        .toSorted(
          (left, right) =>
            (programTypeOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
            (programTypeOrder.get(right) ?? Number.MAX_SAFE_INTEGER)
        )
        .map((programType) => ({
          value: programType,
          label: formatProgramType(programType),
        })),
    [programs]
  );

  const filteredPrograms = React.useMemo(
    () =>
      programs
        .filter((program) =>
          form.program_type ? program.programType === form.program_type : false
        )
        .toSorted((left, right) => left.label.localeCompare(right.label)),
    [form.program_type, programs]
  );

  const selectedProgram = React.useMemo(
    () => programs.find((program) => program.id === form.program_id),
    [form.program_id, programs]
  );

  const availableAcademicLevels = selectedProgram?.academicLevels ?? [];

  function clearProgramSelection(keepProgramType = false) {
    if (!keepProgramType) {
      onChange("program_type", "");
    }

    onChange("program_id", "");
    onChange("program_code", "");
    onChange("program_label", "");
    onChange("academic_level_id", "");
    onChange("academic_level_label", "");
  }

  function handleProgramTypeChange(programType: string) {
    onChange("program_type", programType);

    if (!programType) {
      clearProgramSelection();
      return;
    }

    if (!selectedProgram || selectedProgram.programType !== programType) {
      clearProgramSelection(true);
    }
  }

  function handleProgramChange(programId: string) {
    const program = programs.find((entry) => entry.id === programId);

    if (!program) {
      clearProgramSelection(true);
      return;
    }

    onChange("program_type", program.programType);
    onChange("program_id", program.id);
    onChange("program_code", program.code);
    onChange("program_label", program.label);

    if (program.academicLevels.length === 1) {
      const [level] = program.academicLevels;
      onChange("academic_level_id", level.id);
      onChange("academic_level_label", level.label);
      return;
    }

    onChange("academic_level_id", "");
    onChange("academic_level_label", "");
  }

  function handleAcademicLevelChange(academicLevelId: string) {
    const level = availableAcademicLevels.find(
      (entry) => entry.id === academicLevelId
    );

    if (!level) {
      onChange("academic_level_id", "");
      onChange("academic_level_label", "");
      return;
    }

    onChange("academic_level_id", level.id);
    onChange("academic_level_label", level.label);
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">Program Selection</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Start with the branch where the applicant wants to enroll, then pick
          the program type and the available program under that branch.
        </p>
      </div>

      {!form.branch_id ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
          Select a preferred branch first so the available programs can be loaded.
        </div>
      ) : null}

      {form.branch_id && status === "loading" ? (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-gray-700">
          <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
          Loading available programs for this branch...
        </div>
      ) : null}

      {form.branch_id && status === "error" ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Program options are unavailable right now. Try again in a moment or
            reselect the branch.
          </p>
        </div>
      ) : null}

      {form.branch_id && status === "success" && branch ? (
        <section className="rounded-2xl border border-primary/20 bg-primary/6 p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            Admission Branch
          </p>
          <div className="mt-3 flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-white">
              <Building2 size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h4 className="text-lg font-semibold text-gray-950">
                {branch.title}
              </h4>
              <p className="mt-1 text-sm uppercase tracking-[0.18em] text-gray-600">
                {branch.code}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {form.branch_id && status === "success" && programs.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          No programs are currently assigned to this branch.
        </div>
      ) : null}

      {form.branch_id && status === "success" && programs.length > 0 ? (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <SelectField
              id="program_type"
              label="Program Type"
              value={form.program_type}
              required
              placeholder="Select program type"
              onChange={handleProgramTypeChange}
              hint="Choose the academic category first."
            >
              {availableProgramTypes.map((programType) => (
                <option key={programType.value} value={programType.value}>
                  {programType.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="program_id"
              label="Program"
              value={form.program_id}
              required
              disabled={!form.program_type}
              placeholder={
                form.program_type ? "Select program" : "Select program type first"
              }
              onChange={handleProgramChange}
              hint={
                form.program_type
                  ? "Only programs available in the selected branch are shown."
                  : "Program options will appear after you choose a program type."
              }
            >
              {filteredPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.code} - {program.label}
                </option>
              ))}
            </SelectField>
          </div>

          <SelectField
            id="academic_level_id"
            label="Entry Level"
            value={form.academic_level_id}
            required
            disabled={!selectedProgram}
            placeholder={
              selectedProgram ? "Select entry level" : "Select program first"
            }
            onChange={handleAcademicLevelChange}
            hint={
              selectedProgram
                ? "Choose the year or grade level available for the selected program."
                : "Entry levels are based on the selected program."
            }
          >
            {availableAcademicLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </SelectField>

          {selectedProgram ? (
            <section className="rounded-2xl border border-secondary/20 bg-secondary/5 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                Selected Program
              </p>
              <div className="mt-3 flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-white">
                  {form.program_type === "Bachelor" ? (
                    <GraduationCap size={18} aria-hidden="true" />
                  ) : (
                    <Layers3 size={18} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-semibold text-gray-950">
                    {selectedProgram.code} - {selectedProgram.label}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    {formatProgramType(selectedProgram.programType)}
                    {form.academic_level_label
                      ? ` / ${form.academic_level_label}`
                      : ""}
                  </p>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
