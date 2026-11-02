import { getClassCalendar, type ClassCalendar } from "@/lib/academics/calendar";
import { parseRecordId } from "@/lib/utils";

export type ClassPeriodName = string;
export type ClassPeriodVisibility = Record<string, boolean>;
export function getClassPeriodVisibility(
  value: Parameters<typeof getClassCalendar>[0] | ClassCalendar,
): ClassPeriodVisibility {
  const calendar = "periods" in value ? value : getClassCalendar(value);
  return Object.fromEntries(
    calendar.periods.map((period) => [period.key, period.visible]),
  );
}
type PeriodGrades = {
  periodGrades: Record<string, string | null>;
  average: string | null;
  remarks: string | null;
  note: string | null;
};
/** Project only configured visible keys; final results require every configured period. */
export function getVisiblePeriodGrades(
  grade: PeriodGrades,
  visibility: ClassPeriodVisibility,
): PeriodGrades {
  const allVisible =
    Object.keys(visibility).length > 0 &&
    Object.values(visibility).every(Boolean);
  return {
    periodGrades: Object.fromEntries(
      Object.entries(visibility).map(([key, visible]) => [
        key,
        visible ? (grade.periodGrades[key] ?? null) : null,
      ]),
    ),
    average: allVisible ? grade.average : null,
    remarks: allVisible ? grade.remarks : null,
    note: allVisible ? grade.note : null,
  };
}
export type ClassPeriodVisibilityFormState = {
  success: boolean;
  message: string;
  period?: string;
  visible?: boolean;
  fieldErrors?: Partial<Record<"classId" | "period" | "visible", string>>;
};
export function parseClassPeriodVisibilityForm(
  form: FormData,
):
  | {
      success: true;
      id: bigint;
      termId: bigint;
      period: string;
      visible: boolean;
    }
  | (ClassPeriodVisibilityFormState & { success: false }) {
  const single = (name: string) => {
    const values = form.getAll(name);
    return values.length === 1 && typeof values[0] === "string"
      ? values[0]
      : "";
  };
  const id = parseRecordId(single("classId")),
    termId = parseRecordId(single("termId")),
    period = single("period"),
    visible = single("visible");
  if (
    !id ||
    !termId ||
    !/^period_\d+$/.test(period) ||
    !["true", "false"].includes(visible)
  )
    return {
      success: false,
      message: "Choose a valid class, grading period and visibility.",
    };
  return { success: true, id, termId, period, visible: visible === "true" };
}
