"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import type { ClassFormState, ClassFormValues } from "@/lib/classes/validation";
import { generateSchoolYears } from "@/lib/utils";
import { createClassAction, updateClassAction } from "./actions";
import { ClassRosterImportDialog } from "./class-roster-import-dialog";
import { ClassStudentPicker, type ClassStudentOption } from "./class-student-picker";
import { academicLevelOptions, getSemesterOption, isAcademicLevelAllowedForProgram, semesterOptions } from "@/lib/academic-levels";

type ClassFormProps = {
  teachers: Array<{ id: string; email: string; name?: string }>;
  branches: Array<{ id: string; title: string }>;
  programs: Array<{ id: string; code: string; label: string; programType: string; branchIds: string[]; subjectIds: string[] }>;
  subjects: Array<{ id: string; name: string; code: string | null }>;
  students?: ClassStudentOption[];
} & ({ mode: "create" } | { mode: "edit"; classId: string; values: ClassFormValues });

type ClassField = {
  name: Exclude<keyof ClassFormValues, "teacherId" | "studentIds" | "branchId" | "programId" | "subjectId">;
  label: string;
  placeholder?: string;
  help?: string;
  maxLength: number;
};

const initialState: ClassFormState = { success: false, message: "" };
const emptyValues: ClassFormValues = {
  teacherId: "", branchId: "", programId: "", subjectId: "", schoolYear: "", semester: "", sectionName: "", yearLevel: "", studentIds: [],
};
const fields: ClassField[] = [
  { name: "schoolYear", label: "School year", placeholder: "Select school year", maxLength: 20, help: "Select the school year for this class." },
  { name: "semester", label: "Semester", placeholder: "Select semester", maxLength: 20 },
  { name: "sectionName", label: "Section name", placeholder: "BSIT 1-A", maxLength: 150 },
  { name: "yearLevel", label: "Year level", placeholder: "Select year level", maxLength: 100 },
];

export function ClassForm(props: ClassFormProps) {
  const creating = props.mode === "create";
  const [values, setValues] = useState<ClassFormValues>(() => {
    if (props.mode === "create") return emptyValues;
    const branchId = props.branches.some((branch) => branch.id === props.values.branchId) ? props.values.branchId : "";
    const program = props.programs.find((program) => program.id === props.values.programId && program.branchIds.includes(branchId));
    const subjectId = program?.subjectIds.includes(props.values.subjectId) && props.subjects.some((subject) => subject.id === props.values.subjectId) ? props.values.subjectId : "";
    return {
      ...props.values,
      teacherId: props.teachers.some((teacher) => teacher.id === props.values.teacherId) ? props.values.teacherId : "",
      branchId, programId: program?.id ?? "", subjectId,
      semester: getSemesterOption(props.values.semester)?.value ?? "",
      yearLevel: program && isAcademicLevelAllowedForProgram(program.programType, props.values.yearLevel as Parameters<typeof isAcademicLevelAllowedForProgram>[1]) ? props.values.yearLevel : "",
    };
  });
  const [state, formAction, pending] = useActionState(creating ? createClassAction : updateClassAction, initialState);
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/classes" });
  const errors = state.fieldErrors;
  const selectedStudents = values.studentIds ?? [];
  const availablePrograms = props.programs.filter((program) => program.branchIds.includes(values.branchId));
  const selectedProgram = availablePrograms.find((program) => program.id === values.programId);
  const availableSubjects = selectedProgram ? props.subjects.filter((subject) => selectedProgram.subjectIds.includes(subject.id)) : [];
  const availableLevels = selectedProgram ? academicLevelOptions.filter((level) => isAcademicLevelAllowedForProgram(selectedProgram.programType, level.value)) : [];

  function changeValue(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value, ...(name === "branchId" ? { programId: "", subjectId: "", yearLevel: "" } : name === "programId" ? { subjectId: "", yearLevel: "" } : {}) }));
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="grid w-full max-w-7xl items-start gap-6 lg:grid-cols-2">
      {props.mode === "edit" && <input type="hidden" name="classId" value={props.classId} />}
      <fieldset disabled={pending || state.success} className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-sm">
        <legend className="px-2 text-base font-semibold">Class assignment</legend>
        <p className="mb-5 text-sm text-muted-foreground">Choose a branch, one of its programs, and an assigned subject. The teacher adds their Google Sheets link in My Classes.</p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="class-teacherId" className="block text-sm font-medium">Teacher <span className="text-destructive">*</span></label>
            <select
              id="class-teacherId" name="teacherId" value={values.teacherId} onChange={changeValue} required
              aria-invalid={Boolean(errors?.teacherId)} aria-describedby={errors?.teacherId ? "class-teacherId-error" : undefined}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
            >
              <option value="">Select a teacher</option>
              {props.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name ? teacher.name + " (" + teacher.email + ")" : teacher.email}</option>)}
            </select>
            {errors?.teacherId && <p id="class-teacherId-error" className="text-sm text-destructive">{errors.teacherId}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="class-branchId" className="block text-sm font-medium">Branch <span className="text-destructive">*</span></label>
            <select
              id="class-branchId" name="branchId" value={values.branchId} onChange={changeValue} required
              aria-invalid={Boolean(errors?.branchId)} aria-describedby={errors?.branchId ? "class-branchId-error" : undefined}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
            >
              <option value="">Select a branch</option>
              {props.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.title}</option>)}
            </select>
            {props.branches.length === 0 && <p className="text-sm text-muted-foreground">No saved branches are available. Add a branch before assigning this class.</p>}
            {errors?.branchId && <p id="class-branchId-error" className="text-sm text-destructive">{errors.branchId}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="class-programId" className="block text-sm font-medium">Program <span className="text-destructive">*</span></label>
            <select id="class-programId" name="programId" value={values.programId} onChange={changeValue} required disabled={!values.branchId || availablePrograms.length === 0}
              aria-invalid={Boolean(errors?.programId)} aria-describedby={errors?.programId ? "class-programId-error" : undefined}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-destructive">
              <option value="">{values.branchId ? "Select a program" : "Select a branch first"}</option>
              {availablePrograms.map((program) => <option key={program.id} value={program.id}>{program.code} — {program.label}</option>)}
            </select>
            {values.branchId && availablePrograms.length === 0 && <p className="text-sm text-muted-foreground">No programs are offered by this branch. Assign programs in <Link className="font-medium text-primary hover:underline" href="/portal/branch-programs">Manage Branch Programs</Link>.</p>}
            {errors?.programId && <p id="class-programId-error" className="text-sm text-destructive">{errors.programId}</p>}
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="class-subjectId" className="block text-sm font-medium">Subject <span className="text-destructive">*</span></label>
            <select id="class-subjectId" name="subjectId" value={values.subjectId} onChange={changeValue} required disabled={!selectedProgram || availableSubjects.length === 0}
              aria-invalid={Boolean(errors?.subjectId)} aria-describedby={errors?.subjectId ? "class-subjectId-error" : undefined}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 aria-invalid:border-destructive">
              <option value="">{selectedProgram ? "Select a subject" : "Select a program first"}</option>
              {availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code ? subject.code + " — " : ""}{subject.name}</option>)}
            </select>
            {selectedProgram && availableSubjects.length === 0 && <p className="text-sm text-muted-foreground">This program has no assigned subjects. Add subjects in <Link className="font-medium text-primary hover:underline" href="/portal/subjects">Manage Subjects</Link> and assign them in <Link className="font-medium text-primary hover:underline" href={`/portal/programs/${selectedProgram.id}/subjects`}>Manage Programs</Link>.</p>}
            {props.mode === "edit" && !props.values.programId && <p className="text-sm text-muted-foreground">Choose a program and subject to update this existing class.</p>}
            {errors?.subjectId && <p id="class-subjectId-error" className="text-sm text-destructive">{errors.subjectId}</p>}
          </div>
          {fields.map((field) => {
            const id = `class-${field.name}`;
            const error = errors?.[field.name];
            return (
              <div key={field.name} className="space-y-2">
                <label htmlFor={id} className="block text-sm font-medium">{field.label} <span className="text-destructive">*</span></label>
                {field.name === "schoolYear" ? (
                  <select
                    id={id} name={field.name} value={values.schoolYear} onChange={changeValue} required
                    aria-invalid={Boolean(error)}
                    aria-describedby={[field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
                  >
                    <option value="">{field.placeholder}</option>
                    {generateSchoolYears({ selectedValue: values.schoolYear }).map((schoolYear) => (
                      <option key={schoolYear} value={schoolYear}>{schoolYear}</option>
                    ))}
                  </select>
                ) : field.name === "semester" ? (
                  <select
                    id={id} name={field.name} value={values.semester} onChange={changeValue} required
                    aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
                  >
                    <option value="">{field.placeholder}</option>
                    {semesterOptions.map((semester) => <option key={semester.value} value={semester.value}>{semester.label}</option>)}
                  </select>
                ) : field.name === "yearLevel" ? (
                  <select
                    id={id} name={field.name} value={values.yearLevel} onChange={changeValue} required disabled={!selectedProgram}
                    aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
                  >
                    <option value="">{selectedProgram ? "Select year level" : "Select a program first"}</option>
                    {availableLevels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                  </select>
                ) : (
                  <Input
                    id={id} name={field.name} type="text" value={values[field.name]} onChange={changeValue}
                    required maxLength={field.maxLength} placeholder={field.placeholder} autoComplete="off"
                    aria-invalid={Boolean(error)}
                    aria-describedby={[field.help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
                  />
                )}
                {field.help && <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{field.help}</p>}
                {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
              </div>
            );
          })}
        </div>
      </fieldset>
      <fieldset disabled={pending || state.success} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm">
        <legend className="px-2 text-base font-semibold">Class students</legend>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">Manage the students in this class. Search to add a saved student or upload an Excel reference.</p>
          <ClassRosterImportDialog students={props.students ?? []} selectedIds={selectedStudents} disabled={pending || state.success}
            onApply={(studentIds) => setValues((current) => ({ ...current, studentIds: [...new Set([...(current.studentIds ?? []), ...studentIds])] }))} />
        </div>
        <input type="hidden" name="studentIds" value="" />
        {selectedStudents.map((studentId) => <input key={studentId} type="hidden" name="studentIds" value={studentId} />)}
        <ClassStudentPicker students={props.students ?? []} selectedIds={selectedStudents} disabled={pending || state.success}
          onChange={(studentIds) => setValues((current) => ({ ...current, studentIds: [...new Set(studentIds)] }))} />
        {errors?.studentIds && <p id="class-studentIds-error" role="alert" className="text-sm text-destructive">{errors.studentIds}</p>}
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-3 lg:col-span-2">
        <Button asChild variant="outline"><Link href="/portal/classes">Cancel</Link></Button>
        {props.teachers.length > 0 && (
          <Button type="submit" disabled={pending || !selectedProgram || !values.subjectId || props.branches.length === 0 || state.success}>
            {creating ? <Plus aria-hidden="true" /> : <Save aria-hidden="true" />}
            {pending ? creating ? "Adding class..." : "Saving..." : creating ? "Add class" : "Save changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
