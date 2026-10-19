import type { ClassStatus } from "@/lib/generated/prisma/enums";

export const classStatusOptions = [
  { value: "ongoing", label: "Ongoing", badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { value: "gradeFinalization", label: "Grade finalization", badgeClassName: "border-amber-200 bg-amber-50 text-amber-800" },
  { value: "locked", label: "Locked", badgeClassName: "border-slate-200 bg-slate-100 text-slate-700" },
] as const satisfies readonly { value: ClassStatus; label: string; badgeClassName: string }[];

export function getClassStatusOption(value: unknown) {
  return classStatusOptions.find((option) => option.value === value);
}

export function formatClassStatus(value: unknown) {
  return getClassStatusOption(value)?.label ?? "Ongoing";
}

export const classGradeFields = [
  ["Prelim", "prelim"], ["Midterm", "midterm"], ["Prefinals", "prefinals"],
  ["Finals", "finals"], ["Average", "average"],
] as const;

/** Keep unavailable grades last while preserving nonnumeric spreadsheet markers. */
export function getClassGradeSortValue(value: string | null | undefined, percentages = false): string | number | null {
  if (value == null || !value.trim()) return null;
  const normalized = value.replace(/,/g, "");
  const number = Number(percentages ? normalized.replace(/%$/, "") : normalized);
  return Number.isFinite(number) ? number : value;
}
