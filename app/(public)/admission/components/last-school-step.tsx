"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Search } from "lucide-react";

import type { AdmissionLastSchool } from "@/lib/types/last-schools";
import { Field, FormFields, inputClass, SelectField, TextField } from "./form-fields";
import { detailsSteps, type DetailsFieldName } from "./form-schema";

export type LastSchoolFieldName = DetailsFieldName | "last_school_record_id";
export type LastSchoolFormValues = Record<DetailsFieldName, string> & {
  last_school_record_id?: string;
};

const OTHER_SCHOOL = "other";
const schoolSections = detailsSteps.lastSchool.sections.slice(0, 2);
const academicSection = detailsSteps.lastSchool.sections[2];

function schoolValues(school: AdmissionLastSchool) {
  return {
    last_school_name: school.schoolName,
    last_school_short_name: school.shortName ?? "",
    last_school_id: school.schoolId ?? "",
    last_school_type: school.schoolType,
    last_school_house_number: school.address?.houseNumber ?? "",
    last_school_subdivision: school.address?.subdivision ?? "",
    last_school_street: school.address?.street ?? "",
    last_school_barangay: school.address?.barangay ?? "",
    last_school_city: school.address?.city ?? "",
    last_school_province: school.address?.province ?? "",
    last_school_postal_code: school.address?.postalCode ?? "",
  } satisfies Partial<Record<DetailsFieldName, string>>;
}

function schoolOptionLabel(school: AdmissionLastSchool) {
  return [school.schoolName, school.formattedAddress, school.schoolId ? `ID: ${school.schoolId}` : ""]
    .filter(Boolean).join(" — ");
}

export function LastSchoolStep({ form, onChange }: {
  form: LastSchoolFormValues;
  onChange: (field: LastSchoolFieldName, value: string) => void;
}) {
  const [catalog, setCatalog] = React.useState<{
    attempt: number;
    schools: AdmissionLastSchool[];
    status: "success" | "error";
  } | null>(null);
  const [loadAttempt, setLoadAttempt] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [otherSelected, setOtherSelected] = React.useState(() =>
    !form.last_school_record_id && Boolean(form.last_school_name)
  );
  const currentCatalog = catalog?.attempt === loadAttempt ? catalog : null;
  const status = currentCatalog?.status ?? "loading";
  const schools = currentCatalog?.schools ?? [];
  const recordId = form.last_school_record_id ?? "";
  const selectedValue = recordId || (otherSelected ? OTHER_SCHOOL : "");
  const selectedSchool = schools.find((school) => school.id === recordId);
  const query = search.normalize("NFC").trim().toLocaleLowerCase();
  const filteredSchools = schools.filter((school) => !query || [
    school.schoolName, school.shortName, school.schoolId, school.formattedAddress,
  ].some((value) => value?.normalize("NFC").toLocaleLowerCase().includes(query)));
  const selectionInOptions = filteredSchools.some((school) => school.id === recordId);

  React.useEffect(() => {
    let cancelled = false;

    async function loadSchools() {
      try {
        const { getAdmissionLastSchools } = await import("../actions");
        const result = await getAdmissionLastSchools();
        if (cancelled) return;
        setCatalog({
          attempt: loadAttempt,
          schools: result.schools,
          status: result.error ? "error" : "success",
        });
      } catch {
        if (!cancelled) setCatalog({ attempt: loadAttempt, schools: [], status: "error" });
      }
    }

    void loadSchools();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  function selectSchool(value: string) {
    if (value === OTHER_SCHOOL) {
      setOtherSelected(true);
      onChange("last_school_record_id", "");
      for (const { fields } of schoolSections) {
        for (const { id } of fields) onChange(id, "");
      }
      return;
    }

    const school = schools.find((option) => option.id === value);
    if (!school) return;
    setOtherSelected(false);
    onChange("last_school_record_id", school.id);
    for (const [field, fieldValue] of Object.entries(schoolValues(school))) {
      onChange(field as DetailsFieldName, fieldValue);
    }
  }

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">Previous school</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Search for the school you last attended. If it is not listed, choose Other and enter its details.
        </p>
      </div>

      <section className="min-w-0 space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <Field id="last-school-search" label="Search saved schools" hint="Search by school name, School ID, or location.">
            <div className="relative min-w-0">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="last-school-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="School name or location"
                autoComplete="off"
                className={`${inputClass} pl-9`}
                aria-describedby="last-school-search-hint"
              />
            </div>
          </Field>
          <SelectField
            id="last-school-selection"
            label="Last school attended"
            value={selectedValue}
            onChange={(_field, value) => selectSchool(value)}
            placeholder="Select a school or choose Other"
            required
            hint="Choose the correct campus or school location."
          >
            {recordId && !selectionInOptions && (
              <option value={recordId}>{selectedSchool ? schoolOptionLabel(selectedSchool) : form.last_school_name || "Selected school"}</option>
            )}
            {filteredSchools.map((school) => (
              <option key={school.id} value={school.id}>{schoolOptionLabel(school)}</option>
            ))}
            <option value={OTHER_SCHOOL}>Other — school not listed</option>
          </SelectField>
        </div>

        {status === "loading" ? (
          <p className="flex items-center gap-2 text-sm text-gray-500" role="status">
            <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> Loading saved schools…
          </p>
        ) : status === "error" ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            <p className="flex min-w-0 flex-1 items-start gap-2 leading-6">
              <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
              Saved schools are unavailable. Choose Other to enter your school details.
            </p>
            <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="min-h-11 rounded px-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              Try again
            </button>
          </div>
        ) : filteredSchools.length === 0 ? (
          <p className="text-sm leading-6 text-gray-600" role="status">
            {query ? "No saved schools match your search." : "No schools have been saved yet."} Choose Other if your school is not listed.
          </p>
        ) : null}

        {recordId && (
          <p className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
            <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            School details are filled from the selected school. Choose Other if these details do not match your school.
          </p>
        )}
      </section>

      {(recordId || otherSelected) && schoolSections.map((section) => (
        <section key={section.title} className="min-w-0 space-y-4 sm:space-y-5">
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">{section.title}</h4>
          {recordId ? (
            <div className="grid min-w-0 gap-4 sm:gap-5 md:grid-cols-2">
              {section.fields.map((field) => (
                <TextField key={field.id} id={field.id} label={field.label} value={form[field.id]} readOnly />
              ))}
            </div>
          ) : <FormFields fields={section.fields} values={form} onChange={onChange} />}
        </section>
      ))}

      <section className="min-w-0 space-y-4 sm:space-y-5">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-700">{academicSection.title}</h4>
        <FormFields fields={academicSection.fields} values={form} onChange={onChange} />
      </section>
    </div>
  );
}
