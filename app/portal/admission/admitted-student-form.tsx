"use client";

import Link from "next/link";
import { FileSpreadsheet, Plus, UploadCloud } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import {
  addAdmittedStudentAction,
  bulkAdmitStudentsAction,
  editAdmittedStudentAction,
  type AddAdmittedStudentState,
  type BulkAdmitStudentsState,
} from "@/app/portal/admission/actions";
import {
  AdmissionField,
  AdmissionModal,
  AdmissionSelect,
  type AdmissionOptions,
} from "@/app/portal/admission/admission-ui";
import type { AdmittedStudentPayload } from "@/lib/admission/records";
import { isCapitalizedStudentField, normalizeStudentField, studentUpdateFields, type StudentUpdateField } from "@/lib/admission/student-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast, usePortalFormFeedback } from "@/components/portal/toasts";
import { isAcademicLevelAllowedForProgram } from "@/lib/academic-levels";
import type { AdmissionEditOptions } from "@/lib/portal/admission-options";
import { generateSchoolYears, sanitizeInputText } from "@/lib/utils";

export type AdmittedStudentEditRecord = Omit<AdmittedStudentPayload, "reviewForm">;
export type AdmittedStudentEditOptions = AdmissionEditOptions;

const initialState = { success: false, message: "" } satisfies AddAdmittedStudentState;

type StudentField = {
  name: keyof AdmittedStudentEditRecord;
  label: string;
  required?: boolean;
  type?: "date" | "email";
  choices?: string[];
  placeholder?: string;
};

const personalFields: StudentField[] = [
  { name: "studentNumber", label: "Student number", required: true },
  { name: "email", label: "Student email", type: "email", required: true },
  { name: "firstName", label: "First name", required: true },
  { name: "lastName", label: "Last name", required: true },
  { name: "middleName", label: "Middle name" },
  { name: "suffix", label: "Suffix" },
  { name: "birthDate", label: "Birth date", type: "date", required: true },
  { name: "gender", label: "Gender", choices: ["Female", "Male"], placeholder: "Select gender", required: true },
  { name: "civilStatus", label: "Civil status", choices: ["Single", "Married"], placeholder: "Not specified" },
  { name: "citizenship", label: "Citizenship" },
  { name: "birthplace", label: "Birthplace", required: true },
  { name: "religion", label: "Religion" },
  { name: "phone", label: "Phone", required: true },
  { name: "facebookAccount", label: "Facebook account" },
];

const addFieldNames = new Set([
  "studentNumber", "email", "firstName", "lastName", "birthDate", "gender", "birthplace", "phone",
]);

function addressFields(prefix: "address" | "lastSchool"): StudentField[] {
  return [
    { name: "HouseNumber", label: "House number / unit" },
    { name: "Subdivision", label: "Subdivision / village" },
    { name: "Street", label: "Street" },
    { name: "Barangay", label: "Barangay", required: true },
    { name: "City", label: "City / municipality", required: true },
    { name: "Province", label: "Province", required: true },
    { name: "PostalCode", label: "Postal code" },
  ].map((field) => ({
    ...field,
    name: `${prefix}${field.name}` as StudentField["name"],
  }));
}

const detailSections: Array<{ title: string; fields: StudentField[] }> = [
  { title: "Student Details", fields: personalFields },
  { title: "Home Address", fields: addressFields("address") },
  {
    title: "Parent Or Guardian",
    fields: [
      { name: "guardianFirstName", label: "First name", required: true },
      { name: "guardianLastName", label: "Last name", required: true },
      { name: "guardianMiddleName", label: "Middle name" },
      { name: "guardianSuffix", label: "Suffix" },
      { name: "guardianRelationship", label: "Relationship", required: true },
      { name: "guardianContactNumber", label: "Contact number", required: true },
      { name: "guardianOccupation", label: "Occupation" },
    ],
  },
  {
    title: "Last School Attended",
    fields: [
      { name: "lastSchoolName", label: "School name", required: true },
      { name: "lastSchoolShortName", label: "Short name" },
      { name: "lastSchoolId", label: "School ID" },
      { name: "lastSchoolType", label: "School type", choices: ["Public", "Private", "Other"], placeholder: "Select school type", required: true },
      ...addressFields("lastSchool"),
      { name: "lastSchoolYear", label: "Last school year", required: true },
      { name: "lastSchoolYearLevel", label: "Year level completed", required: true },
      { name: "lastSchoolGraduationDate", label: "Graduation date", type: "date" },
    ],
  },
];

function AdmissionProgramFields({
  options,
  student,
}: {
  options: AdmissionOptions;
  student?: AdmittedStudentEditRecord;
}) {
  const [programId, setProgramId] = useState(student?.programId ?? "");
  const [levelValue, setLevelValue] = useState<string>(student?.academicLevel ?? "");
  const [applicantType, setApplicantType] = useState(student?.applicantType ?? "");
  const [branchId, setBranchId] = useState(student?.branchId ?? "");

  function levelsForProgram(id: string) {
    const program = options.programs.find((item) => item.id === id);
    if (!program) return [];
    return options.academicLevels.filter((level) => isAcademicLevelAllowedForProgram(program.programType, level.value));
  }

  const levels = levelsForProgram(programId);
  const academicLevel = levels.some((level) => level.value === levelValue) ? levelValue : "";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AdmissionField label="Applicant type" required={Boolean(student)}>
        <AdmissionSelect name="applicantType" value={applicantType} onChange={(event) => setApplicantType(event.target.value)} required>
          {!student ? <option value="">Select applicant type</option> : null}
          <option value="new">New</option>
          <option value="existing">Existing</option>
        </AdmissionSelect>
      </AdmissionField>
      <AdmissionField label="Branch" required={Boolean(student)}>
        <AdmissionSelect name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value)} required>
          {!student ? <option value="">Select branch</option> : null}
          {options.branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.title}</option>
          ))}
        </AdmissionSelect>
      </AdmissionField>
      <AdmissionField label="Program" required={Boolean(student)}>
        <AdmissionSelect
          name="programId"
          value={programId}
          onChange={(event) => {
            const id = event.target.value;
            setProgramId(id);
            const nextLevels = levelsForProgram(id);
            setLevelValue((current) => nextLevels.some((level) => level.value === current) ? current : "");
          }}
          required
        >
          <option value="">Select program</option>
          {options.programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} - {program.label} ({program.programType})
            </option>
          ))}
        </AdmissionSelect>
      </AdmissionField>
      <AdmissionField label="Academic level" required={Boolean(student)}>
        <AdmissionSelect name="academicLevel" value={academicLevel} onChange={(event) => setLevelValue(event.target.value)} required>
          <option value="">{programId ? "Select academic level" : "Select program first"}</option>
          {levels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </AdmissionSelect>
      </AdmissionField>
    </div>
  );
}

const profileFieldNames: ReadonlySet<string> = new Set(studentUpdateFields);

function normalizeStudentFormField(name: keyof AdmittedStudentEditRecord, value: string) {
  return profileFieldNames.has(name) ? normalizeStudentField(name as StudentUpdateField, value) : sanitizeInputText(value);
}

function StudentFields({ fields, student }: { fields: StudentField[]; student?: AdmittedStudentEditRecord }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(({ name, choices }) => [name,
    choices || name === "lastSchoolYear" ? student?.[name] ?? "" : normalizeStudentFormField(name, student?.[name] ?? ""),
  ])));
  return fields.map(({ name, label, required, type, choices, placeholder }) => {
    const selectChoices = name === "lastSchoolYear"
      ? generateSchoolYears({ selectedValue: student?.lastSchoolYear })
      : choices;
    const selectPlaceholder = name === "lastSchoolYear" ? "Select school year" : placeholder;
    return (
      <AdmissionField
        key={name}
        label={label}
        required={Boolean(student) && required}
        className={!student && (name === "birthDate" || name === "gender") ? "md:col-span-2" : undefined}
      >
        {selectChoices ? (
          <AdmissionSelect name={name} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} required={required}>
            <option value="" disabled={Boolean(student) && required}>{selectPlaceholder}</option>
            {selectChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </AdmissionSelect>
        ) : (
          <Input name={name} type={type} value={values[name]} required={required}
            onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
            onBlur={(event) => {
              const value = normalizeStudentFormField(name, event.currentTarget.value);
              setValues((current) => ({ ...current, [name]: value }));
            }}
            autoCapitalize={isCapitalizedStudentField(name) ? "words" : "none"}
            spellCheck={type === "email" ? false : undefined}
          />
        )}
      </AdmissionField>
    );
  });
}

export function AddAdmittedStudentModal({ options }: { options: AdmissionOptions }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: AddAdmittedStudentState, formData: FormData) => {
      const next = await addAdmittedStudentAction(previous, formData);
      if (next.success) setOpen(false);
      return next;
    },
    initialState
  );

  useActionToast(state);

  return (
    <AdmissionModal
      open={open}
      onOpenChange={setOpen}
      trigger={<Button type="button"><Plus />Add Student</Button>}
      title="Add Admitted Student"
      description="Enter the student details to add them to admissions."
    >
      <form action={formAction} className="space-y-4 overflow-y-auto p-5">
        <AdmissionProgramFields options={options} />
        <div className="grid gap-4 md:grid-cols-2">
          <StudentFields fields={personalFields.filter((field) => addFieldNames.has(field.name))} />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Adding..." : "Add to Admit"}</Button>
        </div>
      </form>
    </AdmissionModal>
  );
}

export function EditAdmittedStudentForm({ student, options }: { student: AdmittedStudentEditRecord; options: AdmittedStudentEditOptions }) {
  const [state, formAction, pending] = useActionState(editAdmittedStudentAction, initialState);
  const formRef = usePortalFormFeedback(state, { returnTo: "/portal/admission" });

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="space-y-8">
      <input name="studentId" type="hidden" value={student.studentId} />
      <input name="applicationId" type="hidden" value={student.applicationId} />
      <fieldset disabled={pending || state.success} className="min-w-0 space-y-8">
        <legend className="sr-only">Student admission details</legend>
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Applicant And Program</h2>
          <div className="mt-4"><AdmissionProgramFields options={options} student={student} /></div>
        </section>
        {detailSections.map(({ title, fields }) => (
          <section key={title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><StudentFields fields={fields} student={student} /></div>
          </section>
        ))}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-background/95 py-4 backdrop-blur">
          <Button asChild type="button" variant="outline"><Link href="/portal/admission">Back</Link></Button>
          <Button type="submit" disabled={pending || state.success}>{pending ? "Saving..." : "Save Changes"}</Button>
        </div>
      </fieldset>
    </form>
  );
}
export function BulkAdmitStudentsModal({ options }: { options: AdmissionOptions }) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: BulkAdmitStudentsState, formData: FormData) => {
      const next = await bulkAdmitStudentsAction(previous, formData);
      if (next.success) {
        formRef.current?.reset();
        setFileName("");
      }
      return next;
    },
    initialState
  );
  useActionToast(state);

  return (
    <AdmissionModal
      open={open}
      onOpenChange={(value) => {
        if (value) {
          formRef.current?.reset();
          setFileName("");
        }
        setOpen(value);
      }}
      trigger={<Button type="button" variant="outline"><FileSpreadsheet />Bulk Admit</Button>}
      title="Bulk Admit Students"
      description="Choose the admission details, then upload an Excel file."
    >
      <form ref={formRef} action={formAction} className="space-y-5 overflow-y-auto p-5">
        <AdmissionProgramFields options={options} />
        <label
          className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition hover:bg-muted/50"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files.item(0);
            if (fileInputRef.current && file) {
              const transfer = new DataTransfer();
              transfer.items.add(file);
              fileInputRef.current.files = transfer.files;
              setFileName(file.name);
            }
          }}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <span className="mt-3 text-sm font-medium text-foreground">Drag the Excel file here or click to upload</span>
          <span className="mt-1 text-xs text-muted-foreground">
            Required columns: Email Address, First Name, Last Name, Birth date, Student Number
          </span>
          {fileName ? <span className="mt-3 rounded-md bg-background px-2 py-1 text-xs text-foreground">{fileName}</span> : null}
          <input
            ref={fileInputRef}
            name="studentsFile"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            className="sr-only"
            onChange={(event) => setFileName(event.currentTarget.files?.item(0)?.name ?? "")}
          />
        </label>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Importing..." : "Import Students"}</Button>
        </div>
      </form>
    </AdmissionModal>
  );
}

