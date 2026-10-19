"use client";

import Link from "next/link";
import { BadgeCheck, FileSpreadsheet, Plus, UploadCloud } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";

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
import { isCapitalizedStudentField, lastSchoolFieldsFromRecord, normalizeStudentField, studentUpdateFields, type StudentUpdateField } from "@/lib/admission/student-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast, usePortalFormFeedback, usePreservedFormDraft } from "@/components/portal/toasts";
import { ProfileImageField } from "@/components/portal/profile-image-field";
import { isAcademicLevelAllowedForProgram } from "@/lib/academic-levels";
import type { AdmissionEditOptions } from "@/lib/portal/admission-options";
import type { AdmissionLastSchool } from "@/lib/types/last-schools";
import { generateSchoolYears, normalizeEmail, sanitizeInputText } from "@/lib/utils";

export type AdmittedStudentEditRecord = Omit<AdmittedStudentPayload, "reviewForm">;
export type AdmittedStudentEditOptions = AdmissionEditOptions;

const initialState = { success: false, message: "" } satisfies AddAdmittedStudentState;

type StudentField = {
  name: Exclude<keyof AdmittedStudentEditRecord, "userImage">;
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
  requiredFields = true,
}: {
  options: AdmissionOptions;
  student?: AdmittedStudentEditRecord;
  requiredFields?: boolean;
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

  const levels = levelsForProgram(programId || (!requiredFields ? student?.programId ?? "" : ""));
  const academicLevel = levels.some((level) => level.value === levelValue) ? levelValue : "";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <AdmissionField label="Applicant type" required={Boolean(student) && requiredFields}>
        <AdmissionSelect name="applicantType" value={applicantType} onChange={(event) => setApplicantType(event.target.value)} required={requiredFields}>
          {!student || !requiredFields ? <option value="">{student ? "Keep current applicant type" : "Select applicant type"}</option> : null}
          <option value="new">New</option>
          <option value="existing">Existing</option>
        </AdmissionSelect>
      </AdmissionField>
      <AdmissionField label="Branch" required={Boolean(student) && requiredFields}>
        <AdmissionSelect name="branchId" value={branchId} onChange={(event) => setBranchId(event.target.value)} required={requiredFields}>
          {!student || !requiredFields ? <option value="">{student ? "Keep current branch" : "Select branch"}</option> : null}
          {options.branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.title}</option>
          ))}
        </AdmissionSelect>
      </AdmissionField>
      <AdmissionField label="Program" required={Boolean(student) && requiredFields}>
        <AdmissionSelect
          name="programId"
          value={programId}
          onChange={(event) => {
            const id = event.target.value;
            setProgramId(id);
            const nextLevels = levelsForProgram(id || (!requiredFields ? student?.programId ?? "" : ""));
            setLevelValue((current) => nextLevels.some((level) => level.value === current) ? current : "");
          }}
          required={requiredFields}
        >
          <option value="">{student && !requiredFields ? "Keep current program" : "Select program"}</option>
          {options.programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.code} - {program.label} ({program.programType})
            </option>
          ))}
        </AdmissionSelect>
      </AdmissionField>
      <AdmissionField label="Academic level" required={Boolean(student) && requiredFields}>
        <AdmissionSelect name="academicLevel" value={academicLevel} onChange={(event) => setLevelValue(event.target.value)} required={requiredFields}>
          <option value="">{student && !requiredFields ? "Keep current academic level" : programId ? "Select academic level" : "Select program first"}</option>
          {levels.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
        </AdmissionSelect>
      </AdmissionField>
    </div>
  );
}

const profileFieldNames: ReadonlySet<string> = new Set(studentUpdateFields);

function normalizeStudentFormField(name: StudentField["name"], value: string) {
  return profileFieldNames.has(name) ? normalizeStudentField(name as StudentUpdateField, value) : sanitizeInputText(value);
}

function StudentFields({ fields, student, requiredFields = true, readOnly = false }: { fields: StudentField[]; student?: AdmittedStudentEditRecord; requiredFields?: boolean; readOnly?: boolean }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map(({ name, choices }) => [name,
    choices || name === "lastSchoolYear" ? student?.[name] ?? "" : normalizeStudentFormField(name, student?.[name] ?? ""),
  ])));
  return fields.map(({ name, label, required, type, choices, placeholder }) => {
    const selectChoices = name === "lastSchoolYear"
      ? generateSchoolYears({ selectedValue: student?.lastSchoolYear })
      : choices;
    const selectPlaceholder = name === "lastSchoolYear" ? "Select school year" : placeholder;
    const emailChanged = name === "email" && student && (requiredFields || normalizeEmail(values[name])) && normalizeEmail(values[name]) !== normalizeEmail(student.email);
    const emailHintId = emailChanged ? `student-email-change-${student.applicationId}` : undefined;
    const schoolTypeHintId = !requiredFields && name === "lastSchoolType" ? `student-school-type-${student?.applicationId}` : undefined;
    return (
      <AdmissionField
        key={name}
        label={label}
        required={Boolean(student) && requiredFields && required}
        className={!student && (name === "birthDate" || name === "gender") ? "md:col-span-2" : undefined}
      >
        {selectChoices && !readOnly ? (
          <AdmissionSelect name={name} value={values[name]} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} required={requiredFields && required} aria-describedby={schoolTypeHintId}>
            <option value="" disabled={Boolean(student) && requiredFields && required}>{selectPlaceholder}</option>
            {selectChoices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
          </AdmissionSelect>
        ) : (
          <><Input name={name} type={type} value={values[name]} readOnly={readOnly} required={requiredFields && required} aria-describedby={emailHintId}
            onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
            onBlur={(event) => {
              const value = normalizeStudentFormField(name, event.currentTarget.value);
              setValues((current) => ({ ...current, [name]: value }));
            }}
            autoCapitalize={isCapitalizedStudentField(name) ? "words" : "none"}
            spellCheck={type === "email" ? false : undefined}
          />
          {emailChanged ? <p id={emailHintId} className="text-xs leading-5 text-muted-foreground">
            If the student has a portal account, its sign-in email will also change and the new address must be verified before portal access.
          </p> : null}</>
        )}
        {schoolTypeHintId ? <p id={schoolTypeHintId} className="text-xs leading-5 text-muted-foreground">An unspecified school type uses the saved type, or Other for a new school.</p> : null}
      </AdmissionField>
    );
  });
}

function LastSchoolSearch({ schools, value, onChange, error, resetLabel = "Keep current school details" }: {
  schools: AdmissionLastSchool[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  resetLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const inputId = useId();
  const listId = `${inputId}-schools`;
  const selectedSchool = schools.find((school) => school.id === value);
  const query = search.normalize("NFC").trim().toLocaleLowerCase();
  const matches = schools.filter((school) => !query || [school.schoolName, school.shortName, school.formattedAddress]
    .some((text) => text?.normalize("NFC").toLocaleLowerCase().includes(query)));
  const resetValue = "current";
  const optionValues = error ? [] : [...matches.map((school) => school.id), ...(value ? [resetValue] : [])];
  const activeOption = activeValue && optionValues.includes(activeValue) ? activeValue : null;
  const expanded = open && !error;

  useEffect(() => { activeOptionRef.current?.scrollIntoView({ block: "nearest" }); }, [activeOption]);

  function closeMenu() {
    setOpen(false);
    setSearch("");
    setActiveValue(null);
  }

  function selectSchool(id: string) {
    if (!optionValues.includes(id)) return;
    onChange(id === resetValue ? "" : id);
    inputRef.current?.focus();
    closeMenu();
  }

  return (
    <div className="min-w-0 space-y-2" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeMenu(); }}>
      <input type="hidden" name="lastSchoolRecordId" value={value} />
      <label htmlFor={inputId} className="block text-sm font-medium">Find a saved school</label>
      <div className="relative min-w-0">
        <Input ref={inputRef} id={inputId} type="search" role="combobox" value={expanded ? search : selectedSchool?.schoolName ?? ""}
          disabled={Boolean(error)} autoComplete="off" placeholder="Search school name or location"
          aria-autocomplete="list" aria-haspopup="listbox" aria-expanded={Boolean(expanded)}
          aria-controls={expanded ? listId : undefined} aria-activedescendant={expanded && activeOption ? `${listId}-${activeOption}` : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
          onChange={(event) => { setSearch(event.target.value); setActiveValue(null); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (!optionValues.length) { setActiveValue(null); return; }
              const index = expanded && activeOption ? optionValues.indexOf(activeOption) : -1;
              const next = event.key === "ArrowDown" ? (index + 1) % optionValues.length : index <= 0 ? optionValues.length - 1 : index - 1;
              setActiveValue(optionValues[next]);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const id = activeOption ?? matches[0]?.id;
              if (expanded && id) selectSchool(id);
              else setOpen(true);
            } else if (event.key === "Escape" && expanded) {
              event.preventDefault();
              event.stopPropagation();
              closeMenu();
            }
          }} />
        {expanded && <div id={listId} role="listbox" aria-label="Saved schools" className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {matches.length ? matches.map((school) => <button type="button" key={school.id} id={`${listId}-${school.id}`} role="option" tabIndex={-1}
            ref={activeOption === school.id ? activeOptionRef : undefined} aria-selected={value === school.id}
            onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveValue(school.id)} onClick={() => selectSchool(school.id)}
            className={`flex min-h-12 w-full min-w-0 flex-col gap-1 rounded-md px-3 py-2 text-left text-sm hover:bg-accent ${activeOption === school.id ? "bg-accent" : ""}`}>
            <span className="break-words font-medium">{school.schoolName}</span>
            <span className="break-words text-xs text-muted-foreground">{school.formattedAddress}</span>
          </button>) : <p role="status" className="px-3 py-3 text-sm text-muted-foreground">{query ? "No verified schools match your search." : "No verified schools are available yet."}</p>}
          {value && <button type="button" id={`${listId}-${resetValue}`} role="option" aria-selected={false} tabIndex={-1}
            ref={activeOption === resetValue ? activeOptionRef : undefined} onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveValue(resetValue)} onClick={() => selectSchool(resetValue)}
            className={`mt-1 min-h-11 w-full rounded-md border-t border-border px-3 py-2 text-left text-sm font-medium hover:bg-accent ${activeOption === resetValue ? "bg-accent" : ""}`}>{resetLabel}</button>}
        </div>}
      </div>
      {error && <p id={`${inputId}-error`} role="status" className="text-sm text-destructive">Saved schools are unavailable. Reload the page to try again.</p>}
    </div>
  );
}

function VerifiedSchoolMark() {
  return <span role="status" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"><BadgeCheck aria-hidden="true" className="size-3.5" />Verified school</span>;
}

export function AddAdmittedStudentModal({ options, lastSchools = [], lastSchoolsError }: { options: AdmissionOptions; lastSchools?: AdmissionLastSchool[]; lastSchoolsError?: string }) {
  const [open, setOpen] = useState(false);
  const [photoValid, setPhotoValid] = useState(true);
  const [lastSchoolId, setLastSchoolId] = useState("");
  const formRef = usePreservedFormDraft();
  const [state, formAction, pending] = useActionState(
    async (previous: AddAdmittedStudentState, formData: FormData) => {
      const next = await addAdmittedStudentAction(previous, formData);
      if (next.success) { setOpen(false); setLastSchoolId(""); }
      return next;
    },
    initialState
  );

  useActionToast(state);

  return (
    <AdmissionModal
      open={open}
      onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setPhotoValid(true); }}
      trigger={<Button type="button"><Plus />Add Student</Button>}
      title="Add Admitted Student"
      description="Enter the student details to add them to admissions."
    >
      <form ref={formRef} action={formAction} className="space-y-4 overflow-y-auto p-5">
        <fieldset disabled={pending} className="min-w-0 space-y-4">
          <legend className="sr-only">New student details</legend>
          <ProfileImageField disabled={pending} error={state.fieldErrors?.image} onValidityChange={setPhotoValid} />
          <AdmissionProgramFields options={options} />
          <div className="grid gap-4 md:grid-cols-2">
            <StudentFields fields={personalFields.filter((field) => addFieldNames.has(field.name))} />
          </div>
          <section className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Last School Attended</h3>
              {lastSchools.some((school) => school.id === lastSchoolId) && <VerifiedSchoolMark />}
            </div>
            <p className="text-sm text-muted-foreground">Optionally search and select a verified school for this admission.</p>
            <LastSchoolSearch schools={lastSchools} value={lastSchoolId} onChange={setLastSchoolId} error={lastSchoolsError} resetLabel="Do not link a school" />
          </section>
        </fieldset>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={pending || !photoValid}>{pending ? "Adding..." : "Add to Admit"}</Button>
        </div>
      </form>
    </AdmissionModal>
  );
}

export function EditAdmittedStudentForm({ student, options, returnTo = "/portal/admission", action = editAdmittedStudentAction, allowIncomplete = false, allowApproval = false, currentSchoolVerified = false, lastSchools = [], lastSchoolsError }: {
  student: AdmittedStudentEditRecord;
  options: AdmittedStudentEditOptions;
  returnTo?: "/portal/admission" | "/portal/students";
  action?: typeof editAdmittedStudentAction;
  allowIncomplete?: boolean;
  allowApproval?: boolean;
  currentSchoolVerified?: boolean;
  lastSchools?: AdmissionLastSchool[];
  lastSchoolsError?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [photoValid, setPhotoValid] = useState(true);
  const formRef = usePortalFormFeedback(state, { returnTo });
  const [replacementSchoolId, setReplacementSchoolId] = useState("");
  const [schoolEdits, setSchoolEdits] = useState<Record<string, string>>({});
  const replacementSchool = lastSchools.find((school) => school.id === replacementSchoolId);
  const schoolHistoryFields = new Set(["lastSchoolYear", "lastSchoolYearLevel", "lastSchoolGraduationDate"]);
  const schoolInstitutionFields = detailSections.find(({ title }) => title === "Last School Attended")!.fields
    .filter(({ name }) => !schoolHistoryFields.has(name)).map(({ name }) => name);
  const schoolVerified = Boolean(replacementSchool) || (currentSchoolVerified && schoolInstitutionFields.every((name) =>
    normalizeStudentFormField(name, schoolEdits[name] ?? student[name]) === normalizeStudentFormField(name, student[name])));
  const showApproval = allowApproval && returnTo === "/portal/admission";

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="space-y-8">
      <input name="studentId" type="hidden" value={student.studentId} />
      <input name="applicationId" type="hidden" value={student.applicationId} />
      <fieldset disabled={pending || state.success} className="min-w-0 space-y-8">
        <legend className="sr-only">Student admission details</legend>
        <ProfileImageField imageUrl={student.userImage} displayName={`${student.firstName} ${student.lastName}`} disabled={pending || state.success} error={state.fieldErrors?.image} onValidityChange={setPhotoValid} />
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Applicant And Program</h2>
          {allowIncomplete ? <p className="mt-2 text-sm text-muted-foreground">Save the details you have now. Blank name, email, birth date, and admission choices keep their current values. Completely blank address, guardian, or previous-school details keep their saved records.</p> : null}
          <div className="mt-4"><AdmissionProgramFields options={options} student={student} requiredFields={!allowIncomplete} /></div>
        </section>
        {detailSections.map(({ title, fields }) => (
          <section key={title} className="rounded-lg border border-border bg-card p-5 shadow-sm" onChange={title === "Last School Attended" ? (event) => {
            const { name, value } = event.target as HTMLInputElement | HTMLSelectElement;
            if (schoolInstitutionFields.includes(name as StudentField["name"])) {
              setSchoolEdits((current) => ({ ...current, [name]: value }));
            }
          } : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2>
              {title === "Last School Attended" && schoolVerified && <VerifiedSchoolMark />}
            </div>
            {title === "Last School Attended" && <div className="mt-4 space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground">If this student suggested a school that is already listed, select its verified record below. Saving changes only this admission&apos;s school link.</p>
              <LastSchoolSearch schools={lastSchools} value={replacementSchoolId} onChange={(id) => { setReplacementSchoolId(id); setSchoolEdits({}); }} error={lastSchoolsError} />
              {replacementSchool && <p role="status" className="text-sm text-emerald-700">The saved school details are filled below. The student&apos;s school year, completed year level, and graduation date stay editable.</p>}
            </div>}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {title === "Last School Attended" ? <>
                <StudentFields key={replacementSchoolId || "current-school"} fields={fields.filter(({ name }) => !schoolHistoryFields.has(name))}
                  student={replacementSchool ? { ...student, ...lastSchoolFieldsFromRecord(replacementSchool) } : student}
                  readOnly={Boolean(replacementSchool)} requiredFields={!allowIncomplete} />
                <StudentFields fields={fields.filter(({ name }) => schoolHistoryFields.has(name))} student={student} requiredFields={!allowIncomplete} />
              </> : <StudentFields fields={fields} student={student} requiredFields={!allowIncomplete} />}
            </div>
          </section>
        ))}
        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-border bg-background/95 py-4 backdrop-blur">
          <Button asChild type="button" variant="outline"><Link href={returnTo}>Back</Link></Button>
          <Button type="submit" name="intent" value="save" variant={showApproval ? "outline" : "default"} disabled={pending || state.success || !photoValid}>{pending ? "Saving..." : "Save Changes"}</Button>
          {showApproval && <Button type="submit" name="intent" value="saveAndApprove" className="w-full sm:w-auto" disabled={pending || state.success || !photoValid}><BadgeCheck aria-hidden="true" />{pending ? "Saving..." : "Save changes and approve"}</Button>}
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
      description="Choose the admission details, then upload your student spreadsheet."
    >
      <form ref={formRef} action={formAction} className="min-w-0 space-y-5 overflow-y-auto p-5">
        <AdmissionProgramFields options={options} />
        <section aria-label="Spreadsheet instructions" className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <h3 className="font-semibold text-foreground">Import instructions</h3>
          <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
            <li>Select the admission details above. These apply to every student in the file.</li>
            <li>Use the headers below in the first row of the first worksheet, with one student per row. All five columns are required.</li>
          </ol>
          <div className="overflow-x-auto rounded-md border border-border bg-background">
            <table className="w-full min-w-[38rem] text-left text-xs">
              <caption className="sr-only">Example student spreadsheet with the five required columns</caption>
              <thead className="border-b border-border bg-muted/50 text-foreground">
                <tr>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">Student Number</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">Email Address</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">First Name</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">Last Name</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium">Birth Date</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr>
                  <td className="whitespace-nowrap px-3 py-2">000123</td>
                  <td className="whitespace-nowrap px-3 py-2">student@example.com</td>
                  <td className="whitespace-nowrap px-3 py-2">Maria</td>
                  <td className="whitespace-nowrap px-3 py-2">Santos</td>
                  <td className="whitespace-nowrap px-3 py-2">2008-05-21</td>
                </tr>
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>Format Student Number cells as Text to keep leading zeros.</li>
            <li>Use YYYY-MM-DD for birth dates, or Excel date cells. You may add an optional Gender column using Male or Female.</li>
            <li>Student numbers and email addresses must be unique and must not already be registered. This import adds new records; it does not update existing students.</li>
          </ul>
          <p className="text-xs text-muted-foreground">If any row has an error, no students are imported. Correct the reported errors and upload the file again.</p>
        </section>
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
            .xlsx, .xls, or .csv · Up to 5 MB · Up to 999 students plus one header row
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

