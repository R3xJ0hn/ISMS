import { capitalizeInputText, sanitizeInputText } from "@/lib/utils";

export type TermValues = {
  name: string;
  averageColumn?: number;
  equivalentColumn?: number;
  periods: { name: string; worksheetName: string; reportColumn?: number }[];
};
export type SchemeValues = { name: string; terms: TermValues[] };
export type SchemeState = { success: boolean; message: string };

export const academicPresets: Record<string, SchemeValues> = {
  collegeFour: {
    name: "College — Four Grading Periods",
    terms: ["1st Semester", "2nd Semester"].map((name) => ({
      name,
      periods: ["Prelim", "Midterm", "Prefinals", "Finals"].map((name) => ({
        name,
        worksheetName: name === "Prefinals" ? "Pre-Finals" : name,
      })),
    })),
  },
  collegeThree: {
    name: "College — Three Grading Periods",
    terms: ["1st Semester", "2nd Semester"].map((name) => ({
      name,
      periods: ["Prelim", "Midterm", "Finals"].map((name) => ({
        name,
        worksheetName: name,
      })),
    })),
  },
  shs: {
    name: "SHS — Two Semesters",
    terms: [0, 1].map((index) => ({
      name: `${index + 1}${index ? "nd" : "st"} Semester`,
      periods: [1, 2].map((quarter) => ({
        name: `Q${index * 2 + quarter}`,
        worksheetName: `Q${index * 2 + quarter}`,
      })),
    })),
  },
  trimester: {
    name: "Three Terms — Overall Grade",
    terms: ["1st Term", "2nd Term", "3rd Term"].map((name) => ({
      name,
      periods: [{ name: "Overall", worksheetName: "Activities" }],
    })),
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function academicLabel(value: string) {
  return capitalizeInputText(value).replace(
    /(\d)(St|Nd|Rd|Th)\b/g,
    (_match, digit: string, suffix: string) => digit + suffix.toLowerCase(),
  );
}

export function parseScheme(
  raw: unknown,
):
  | { success: true; values: SchemeValues }
  | { success: false; message: string } {
  const invalid = (message: string) => ({ success: false as const, message });
  if (
    !isObject(raw) ||
    typeof raw.name !== "string" ||
    !Array.isArray(raw.terms)
  )
    return invalid("Enter a scheme name and its terms.");
  const name = academicLabel(raw.name);
  if (!name || name.length > 120)
    return invalid("Use a scheme name between 1 and 120 characters.");
  if (raw.terms.length < 1 || raw.terms.length > 6)
    return invalid("Add between 1 and 6 academic terms.");
  const terms: TermValues[] = [];
  const names = new Set<string>();
  for (const term of raw.terms) {
    if (
      !isObject(term) ||
      typeof term.name !== "string" ||
      !Array.isArray(term.periods)
    )
      return invalid("Check each term and its grading periods.");
    const termName = academicLabel(term.name);
    if (!termName || termName.length > 80 || names.has(termName.toLowerCase()))
      return invalid("Term names must be unique and use 1–80 characters.");
    names.add(termName.toLowerCase());
    if (term.periods.length < 1 || term.periods.length > 8)
      return invalid(
        "Each term needs 1–8 grading periods. Use Overall when there are no subdivisions.",
      );
    const periods: TermValues["periods"] = [];
    const columns = new Set<number>();
    const periodNames = new Set<string>();
    const sheets = new Set<string>();
    for (const period of term.periods) {
      if (
        !isObject(period) ||
        typeof period.name !== "string" ||
        typeof period.worksheetName !== "string"
      )
        return invalid(
          "Enter a label and worksheet name for every grading period.",
        );
      const periodName = academicLabel(period.name);
      // Worksheet names must retain exact case, spacing and punctuation used in Sheets.
      const worksheetName = sanitizeInputText(period.worksheetName);
      if (
        !periodName ||
        periodName.length > 80 ||
        periodNames.has(periodName.toLowerCase())
      )
        return invalid(
          `Use unique grading period names of 1–80 characters within ${termName}.`,
        );
      if (
        !worksheetName ||
        worksheetName.length > 100 ||
        sheets.has(worksheetName.toLowerCase())
      )
        return invalid(
          `Use unique worksheet names of 1–100 characters within ${termName}.`,
        );
      periodNames.add(periodName.toLowerCase());
      sheets.add(worksheetName.toLowerCase());
      const reportColumn = period.reportColumn ?? periods.length + 3;
      if (
        typeof reportColumn !== "number" ||
        !Number.isSafeInteger(reportColumn) ||
        reportColumn < 3 ||
        reportColumn > 702 ||
        columns.has(reportColumn)
      )
        return invalid(
          "Use distinct REPORT column numbers from 3 to 702 for grading periods.",
        );
      columns.add(reportColumn);
      periods.push({ name: periodName, worksheetName, reportColumn });
    }
    const averageColumn = term.averageColumn ?? periods.length + 3,
      equivalentColumn = term.equivalentColumn ?? periods.length + 4;
    if (
      [averageColumn, equivalentColumn].some(
        (column) =>
          typeof column !== "number" ||
          !Number.isSafeInteger(column) ||
          column < 3 ||
          column > 702 ||
          columns.has(column as number),
      ) ||
      averageColumn === equivalentColumn
    )
      return invalid(
        "Average and equivalent columns must be distinct from each other and the period columns (3–702).",
      );
    terms.push({
      name: termName,
      periods,
      averageColumn: averageColumn as number,
      equivalentColumn: equivalentColumn as number,
    });
  }
  return { success: true, values: { name, terms } };
}
