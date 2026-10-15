export type GradeStatus = "passed" | "failed" | "incomplete" | "unavailable";

export type GradeScaleEntry = {
  equivalent: string;
  range: string;
  description: string | null;
  minimum: number | null;
  maximum: number | null;
  status: Exclude<GradeStatus, "unavailable">;
};

/** Percentage bounds apply after rounding the recorded average to a whole number. */
export const GRADE_SCALE: readonly GradeScaleEntry[] = [
  { equivalent: "1.00", range: "98% - 100%", description: "Excellent", minimum: 98, maximum: 100, status: "passed" },
  { equivalent: "1.25", range: "95% - 97%", description: "Very Good", minimum: 95, maximum: 97, status: "passed" },
  { equivalent: "1.50", range: "92% - 94%", description: null, minimum: 92, maximum: 94, status: "passed" },
  { equivalent: "1.75", range: "89% - 91%", description: null, minimum: 89, maximum: 91, status: "passed" },
  { equivalent: "2.00", range: "86% - 88%", description: "Good", minimum: 86, maximum: 88, status: "passed" },
  { equivalent: "2.25", range: "83% - 85%", description: null, minimum: 83, maximum: 85, status: "passed" },
  { equivalent: "2.50", range: "80% - 82%", description: "Satisfactory", minimum: 80, maximum: 82, status: "passed" },
  { equivalent: "2.75", range: "76% - 79%", description: "Fair", minimum: 76, maximum: 79, status: "passed" },
  { equivalent: "3.00", range: "75%", description: "Passed", minimum: 75, maximum: 75, status: "passed" },
  { equivalent: "5.00", range: "Below 75%", description: "Failed", minimum: 0, maximum: 74, status: "failed" },
  { equivalent: "INC", range: "Incomplete", description: null, minimum: null, maximum: null, status: "incomplete" },
];

export type GradeEquivalent = {
  equivalent: string | null;
  description: string | null;
  status: GradeStatus;
  /** The recorded percentage, without rounding or calculating from term grades. */
  average: number | null;
  roundedAverage: number | null;
};

function parseAverage(value: string | null): number | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  // Only decimal percentages are accepted: never evaluate formulas or infer a score from text.
  if (!/^\d+(?:\.\d+)?(?:\s*%)?$/.test(text)) return null;
  const average = Number(text.replace(/\s*%$/, ""));
  return Number.isFinite(average) && average >= 0 && average <= 100 ? average : null;
}

function isIncomplete(value: string | null | undefined): boolean {
  return typeof value === "string" && /^(?:inc\.?|incomplete)$/i.test(value.trim());
}

/** Resolve only the explicit average and whole-value incomplete markers supplied by the sheet. */
export function getGradeEquivalent(
  value: string | null,
  remarks?: string | null,
): GradeEquivalent {
  const average = parseAverage(value);
  const roundedAverage = average === null ? null : Math.round(average);

  if (isIncomplete(value) || isIncomplete(remarks)) {
    return { equivalent: "INC", description: null, status: "incomplete", average, roundedAverage };
  }

  const match = roundedAverage === null
    ? undefined
    : GRADE_SCALE.find(({ minimum, maximum }) => (
      minimum !== null && maximum !== null && roundedAverage >= minimum && roundedAverage <= maximum
    ));

  return {
    equivalent: match?.equivalent ?? null,
    description: match?.description ?? null,
    status: match?.status ?? "unavailable",
    average,
    roundedAverage,
  };
}
