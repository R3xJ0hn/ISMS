"use client";

import * as React from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, LoaderCircle, Search } from "lucide-react";

import type { AdmissionLastSchool } from "@/lib/types/last-schools";
import { Field, FormFields, inputClass, TextField } from "./form-fields";
import { detailsSteps, type DetailsFieldName } from "./form-schema";

export type LastSchoolFieldName = DetailsFieldName | "last_school_record_id";
export type LastSchoolFormValues = Record<DetailsFieldName, string> & {
  last_school_record_id?: string;
};

const OTHER_SCHOOL = "other";
const schoolSections = detailsSteps.lastSchool.sections.slice(0, 2);
const hiddenSchoolFields: ReadonlySet<DetailsFieldName> = new Set([
  "last_school_id", "last_school_house_number", "last_school_subdivision",
]);
const visibleSchoolSections = schoolSections.map((section) => ({
  ...section, fields: section.fields.filter(({ id }) => !hiddenSchoolFields.has(id)),
}));
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
  const [open, setOpen] = React.useState(false);
  const [activeValue, setActiveValue] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const activeOptionRef = React.useRef<HTMLButtonElement>(null);
  const listId = React.useId();
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
    school.schoolName, school.shortName, school.formattedAddress,
  ].some((value) => value?.normalize("NFC").toLocaleLowerCase().includes(query)));
  const canSuggestSchool = status === "success" && filteredSchools.length === 0 && (Boolean(query) || schools.length === 0);
  const optionValues = status === "success"
    ? [...filteredSchools.map((school) => school.id), ...(canSuggestSchool ? [OTHER_SCHOOL] : [])]
    : [];
  const activeOption = activeValue && optionValues.includes(activeValue) ? activeValue : null;
  const selectionMessage = status === "loading"
    ? "Wait for saved schools to load, then select your school."
    : status === "error"
      ? "Try loading saved schools again before selecting your school."
      : canSuggestSchool ? "Choose Other to enter your school's details." : "Select a saved school or search for your school.";
  const selectedLabel = recordId
    ? selectedSchool?.schoolName || form.last_school_name || "Selected school"
    : otherSelected ? "Other — school not listed" : "";

  React.useEffect(() => {
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

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
    if (!optionValues.includes(value)) return;
    if (value === OTHER_SCHOOL) {
      setOtherSelected(true);
      onChange("last_school_record_id", "");
      for (const { fields } of schoolSections) {
        for (const { id } of fields) onChange(id, "");
      }
    } else {
      const school = schools.find((option) => option.id === value);
      if (!school) return;
      setOtherSelected(false);
      onChange("last_school_record_id", school.id);
      for (const [field, fieldValue] of Object.entries(schoolValues(school))) {
        onChange(field as DetailsFieldName, fieldValue);
      }
    }

    inputRef.current?.setCustomValidity("");
    inputRef.current?.focus();
    closeMenu();
  }

  function closeMenu() {
    setOpen(false);
    setSearch("");
    setActiveValue(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (optionValues.length === 0) {
        setActiveValue(null);
        return;
      }
      const current = open && activeOption ? optionValues.indexOf(activeOption) : -1;
      const next = event.key === "ArrowDown"
        ? (current + 1) % optionValues.length
        : current <= 0 ? optionValues.length - 1 : current - 1;
      setActiveValue(optionValues[next]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open) {
        const value = activeOption ?? optionValues[0];
        if (value) selectSchool(value);
      } else setOpen(true);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu();
    }
  }

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-950">Previous school</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Search for the school you last attended and select it from the results. If your search has no matches, choose Other and enter its details. New school suggestions are reviewed before they appear in this list.
        </p>
      </div>

      <section className="min-w-0 space-y-4">
        <div className="min-w-0" onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
        }}>
          <Field id="last-school-search" label="Last school attended" required hint={status === "error" ? "Try again to load the saved school list." : status === "loading" ? "Loading the saved school list. Please wait before selecting a school." : "Search by school name or location. Other appears only when no saved schools match."}>
            <div className="relative min-w-0">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                id="last-school-search"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-activedescendant={open && activeOption ? `${listId}-${activeOption}` : undefined}
                aria-required="true"
                required={!selectedValue}
                value={open ? search : selectedLabel}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveValue(null);
                  setOpen(true);
                  event.currentTarget.setCustomValidity(selectedValue ? "" : selectionMessage);
                }}
                onKeyDown={handleKeyDown}
                onInvalid={(event) => event.currentTarget.setCustomValidity(selectionMessage)}
                placeholder="Search school name or location"
                autoComplete="off"
                className={`${inputClass} pl-9 pr-10`}
                aria-describedby="last-school-search-hint"
              />
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              {open && (
                <div id={listId} role="listbox" aria-label="Saved schools" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="max-h-56 overflow-y-auto overscroll-contain">
                    {status === "loading" ? (
                      <p className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500" role="status">
                        <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" /> Loading saved schools…
                      </p>
                    ) : status === "error" ? (
                      <p className="px-4 py-3 text-sm leading-6 text-gray-600" role="status">Saved schools are unavailable. Try again to search for your school.</p>
                    ) : filteredSchools.length === 0 ? (
                      <p className="px-4 py-3 text-sm leading-6 text-gray-600" role="status">{query ? "No saved schools match your search." : "No schools have been saved yet."}</p>
                    ) : filteredSchools.map((school) => (
                      <button key={school.id} id={`${listId}-${school.id}`} type="button" role="option" tabIndex={-1}
                        ref={activeOption === school.id ? activeOptionRef : undefined}
                        aria-selected={recordId === school.id}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectSchool(school.id)}
                        className={`flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 ${activeOption === school.id ? "bg-blue-50 outline-none" : ""}`}>
                        <span className="min-w-0 flex-1"><span className="block break-words text-sm font-semibold text-gray-900">{school.schoolName}</span>{school.formattedAddress && <span className="mt-1 block break-words text-xs leading-5 text-gray-500">{school.formattedAddress}</span>}</span>
                        {recordId === school.id && <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />}
                      </button>
                    ))}
                  </div>
                  {canSuggestSchool && <button id={`${listId}-${OTHER_SCHOOL}`} type="button" role="option" tabIndex={-1}
                    ref={activeOption === OTHER_SCHOOL ? activeOptionRef : undefined}
                    aria-selected={otherSelected && !recordId}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSchool(OTHER_SCHOOL)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-left text-sm font-semibold text-primary hover:bg-gray-50 ${activeOption === OTHER_SCHOOL ? "bg-blue-50 outline-none" : "bg-white"}`}>
                    <span>Other — school not listed</span>
                    {otherSelected && !recordId && <Check aria-hidden="true" className="size-4 shrink-0" />}
                  </button>}
                </div>
              )}
            </div>
          </Field>
        </div>

        {status === "error" && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            <p className="flex min-w-0 flex-1 items-start gap-2 leading-6">
              <AlertCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
              Saved schools are unavailable. Try again before choosing a school.
            </p>
            <button type="button" onClick={() => { setLoadAttempt((attempt) => attempt + 1); setOpen(true); }} className="min-h-11 rounded px-2 font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              Try again
            </button>
          </div>
        )}

        {recordId && (
          <p className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm leading-6 text-emerald-900">
            <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
            School details are filled from the selected school. Search again to choose a different school.
          </p>
        )}
      </section>

      {(recordId || otherSelected) && visibleSchoolSections.map((section) => (
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
