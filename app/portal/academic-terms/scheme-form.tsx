"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePortalFormFeedback } from "@/components/portal/toasts";
import {
  academicPresets,
  type SchemeState,
  type SchemeValues,
} from "@/lib/academics/validation";
import { saveAcademicSchemeAction, assignProgramSchemeAction } from "./actions";

const initialState: SchemeState = { success: false, message: "" };
const emptyPeriod = () => ({ name: "", worksheetName: "" });
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ProgramSchemeForm({
  programs,
  schemes,
}: {
  programs: { id: string; name: string; schemeId: string }[];
  schemes: { id: string; name: string }[];
}) {
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [schemeId, setSchemeId] = useState(programs[0]?.schemeId ?? "");
  const [state, action, pending] = useActionState(
    assignProgramSchemeAction,
    initialState,
  );
  const ref = usePortalFormFeedback(state, {
    returnTo: "/portal/academic-terms",
    refresh: true,
  });
  return (
    <form
      ref={ref}
      action={action}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      <h2 className="font-semibold">Program calendar</h2>
      <p className="text-sm text-muted-foreground">
        Choose the default scheme for new classes. Previously assigned class
        terms are preserved.
      </p>
      <div className="grid items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <label htmlFor="default-program" className="text-sm">
            Program
          </label>
          <select
            id="default-program"
            name="programId"
            value={programId}
            required
            disabled={pending}
            className={selectClass}
            onChange={(event) => {
              setProgramId(event.target.value);
              setSchemeId(
                programs.find((p) => p.id === event.target.value)?.schemeId ??
                  "",
              );
            }}
          >
            <option value="">Select program</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor="default-scheme" className="text-sm">
            Academic scheme
          </label>
          <select
            id="default-scheme"
            name="schemeId"
            value={schemeId}
            required
            disabled={pending}
            onChange={(event) => setSchemeId(event.target.value)}
            className={selectClass}
          >
            <option value="">Select scheme</option>
            {schemes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button disabled={pending || !programId || !schemeId} type="submit">
          {pending ? "Saving..." : "Assign scheme"}
        </Button>
      </div>
      {!state.success && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function SchemeForm({
  initial,
  schemeId,
  revision,
}: {
  initial?: SchemeValues;
  schemeId?: string;
  revision?: number;
}) {
  const [values, setValues] = useState<SchemeValues>(() =>
    structuredClone(initial ?? academicPresets.collegeFour),
  );
  const [state, action, pending] = useActionState(
    saveAcademicSchemeAction,
    initialState,
  );
  const ref = usePortalFormFeedback(state, {
    returnTo: "/portal/academic-terms",
    refresh: true,
  });
  const changeTerm = (index: number, name: string) =>
    setValues((current) => ({
      ...current,
      terms: current.terms.map((term, i) =>
        i === index ? { ...term, name } : term,
      ),
    }));
  const changePeriod = (
    termIndex: number,
    periodIndex: number,
    field: "name" | "worksheetName",
    value: string,
  ) =>
    setValues((current) => ({
      ...current,
      terms: current.terms.map((term, i) =>
        i === termIndex
          ? {
              ...term,
              periods: term.periods.map((period, j) =>
                j === periodIndex ? { ...period, [field]: value } : period,
              ),
            }
          : term,
      ),
    }));
  return (
    <form
      ref={ref}
      action={action}
      className="w-full max-w-4xl space-y-6"
      aria-busy={pending}
    >
      <input type="hidden" name="values" value={JSON.stringify(values)} />
      {schemeId && (
        <>
          <input type="hidden" name="schemeId" value={schemeId} />
          <input type="hidden" name="revision" value={revision} />
        </>
      )}
      <fieldset
        disabled={pending || state.success}
        className="min-w-0 space-y-6"
      >
        <div className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
          {!schemeId && (
            <div className="space-y-2">
              <label htmlFor="academic-preset" className="text-sm font-medium">
                Start from a preset
              </label>
              <select
                id="academic-preset"
                className={selectClass}
                defaultValue=""
                onChange={(event) => {
                  const preset = academicPresets[event.target.value];
                  if (preset) setValues(structuredClone(preset));
                }}
              >
                <option value="" disabled>
                  Choose a preset to replace the form
                </option>
                {Object.entries(academicPresets).map(([key, preset]) => (
                  <option key={key} value={key}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="scheme-name" className="text-sm font-medium">
              Scheme name
            </label>
            <Input
              id="scheme-name"
              required
              maxLength={120}
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Terms divide the school year. Grading periods divide a class within
            a term. Use one period named Overall for a term without
            subdivisions. Worksheet names must match the Google Sheets tabs
            exactly.
          </p>
        </div>
        {values.terms.map((term, termIndex) => (
          <section
            key={termIndex}
            className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5"
            aria-label={`Academic term ${termIndex + 1}`}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Term {termIndex + 1}</h2>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={values.terms.length === 1}
                aria-label={`Remove term ${termIndex + 1}`}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    terms: current.terms.filter((_, i) => i !== termIndex),
                  }))
                }
              >
                <Trash2 aria-hidden="true" />
                Remove term
              </Button>
            </div>
            <div className="space-y-2">
              <label
                htmlFor={`term-${termIndex}`}
                className="text-sm font-medium"
              >
                Term name
              </label>
              <Input
                id={`term-${termIndex}`}
                required
                maxLength={80}
                value={term.name}
                onChange={(event) => changeTerm(termIndex, event.target.value)}
                placeholder="e.g. 1st Semester or 1st Trimester"
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                REPORT columns use numbers: C = 3, D = 4, E = 5. Column B
                contains student names.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(["averageColumn", "equivalentColumn"] as const).map(
                  (field, index) => (
                    <div key={field} className="space-y-2">
                      <label
                        htmlFor={`${field}-${termIndex}`}
                        className="text-xs text-muted-foreground"
                      >
                        {index ? "Equivalent" : "Average"} column
                      </label>
                      <Input
                        id={`${field}-${termIndex}`}
                        type="number"
                        min={3}
                        max={702}
                        required
                        value={term[field] ?? term.periods.length + 3 + index}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            terms: current.terms.map((item, i) =>
                              i === termIndex
                                ? {
                                    ...item,
                                    [field]: Number(event.target.value),
                                  }
                                : item,
                            ),
                          }))
                        }
                      />
                    </div>
                  ),
                )}
              </div>
              <h3 className="text-sm font-medium">
                Grading periods{" "}
                <span className="font-normal text-muted-foreground">
                  — listed in order
                </span>
              </h3>
              {term.periods.map((period, periodIndex) => (
                <div
                  key={periodIndex}
                  className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-3 border-b pb-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <div className="space-y-2">
                    <label
                      htmlFor={`period-${termIndex}-${periodIndex}`}
                      className="text-xs text-muted-foreground"
                    >
                      Display name
                    </label>
                    <Input
                      id={`period-${termIndex}-${periodIndex}`}
                      required
                      maxLength={80}
                      value={period.name}
                      onChange={(event) =>
                        changePeriod(
                          termIndex,
                          periodIndex,
                          "name",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="col-start-1 row-start-2 space-y-2 sm:col-auto sm:row-auto">
                    <label
                      htmlFor={`worksheet-${termIndex}-${periodIndex}`}
                      className="text-xs text-muted-foreground"
                    >
                      Worksheet name
                    </label>
                    <Input
                      id={`worksheet-${termIndex}-${periodIndex}`}
                      required
                      maxLength={100}
                      value={period.worksheetName}
                      onChange={(event) =>
                        changePeriod(
                          termIndex,
                          periodIndex,
                          "worksheetName",
                          event.target.value,
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-start-2 row-start-1 sm:col-auto sm:row-auto"
                    disabled={term.periods.length === 1}
                    aria-label={`Remove period ${periodIndex + 1} from term ${termIndex + 1}`}
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        terms: current.terms.map((item, i) =>
                          i === termIndex
                            ? {
                                ...item,
                                periods: item.periods.filter(
                                  (_, j) => j !== periodIndex,
                                ),
                              }
                            : item,
                        ),
                      }))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                  <div className="col-span-full space-y-2">
                    <label
                      htmlFor={`report-${termIndex}-${periodIndex}`}
                      className="text-xs text-muted-foreground"
                    >
                      REPORT column
                    </label>
                    <Input
                      id={`report-${termIndex}-${periodIndex}`}
                      className="max-w-32"
                      type="number"
                      min={3}
                      max={702}
                      required
                      value={period.reportColumn ?? periodIndex + 3}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          terms: current.terms.map((item, i) =>
                            i === termIndex
                              ? {
                                  ...item,
                                  periods: item.periods.map((p, j) =>
                                    j === periodIndex
                                      ? {
                                          ...p,
                                          reportColumn: Number(
                                            event.target.value,
                                          ),
                                        }
                                      : p,
                                  ),
                                }
                              : item,
                          ),
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={term.periods.length >= 8}
                onClick={() =>
                  setValues((current) => ({
                    ...current,
                    terms: current.terms.map((item, i) =>
                      i === termIndex
                        ? { ...item, periods: [...item.periods, emptyPeriod()] }
                        : item,
                    ),
                  }))
                }
              >
                <Plus aria-hidden="true" />
                Add grading period
              </Button>
            </div>
          </section>
        ))}
        <Button
          type="button"
          variant="outline"
          disabled={values.terms.length >= 6}
          onClick={() =>
            setValues((current) => ({
              ...current,
              terms: [...current.terms, { name: "", periods: [emptyPeriod()] }],
            }))
          }
        >
          <Plus aria-hidden="true" />
          Add term
        </Button>
        {state.message && !state.success && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button asChild variant="outline">
            <Link href="/portal/academic-terms">Cancel</Link>
          </Button>
          <Button type="submit">
            <Save aria-hidden="true" />
            {pending ? "Saving..." : "Save academic scheme"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
