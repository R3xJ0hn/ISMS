import { parseClassId } from "./validation";

export const classPeriodDefinitions = [
  { period: "Prelim", label: "Prelim", field: "prelimVisible" },
  { period: "Midterm", label: "Midterm", field: "midtermVisible" },
  { period: "Prefinals", label: "Prefinals", field: "prefinalsVisible" },
  { period: "Finals", label: "Finals", field: "finalsVisible" },
] as const;

export type ClassPeriodName = typeof classPeriodDefinitions[number]["period"];
export type ClassPeriodVisibilityField = typeof classPeriodDefinitions[number]["field"];
export type ClassPeriodVisibility = Record<ClassPeriodVisibilityField, boolean>;

export const defaultClassPeriodVisibility: Readonly<ClassPeriodVisibility> = {
  prelimVisible: true,
  midtermVisible: true,
  prefinalsVisible: true,
  finalsVisible: true,
};

export function getClassPeriodVisibility(value?: Partial<ClassPeriodVisibility> | null): ClassPeriodVisibility {
  return {
    prelimVisible: value?.prelimVisible !== false,
    midtermVisible: value?.midtermVisible !== false,
    prefinalsVisible: value?.prefinalsVisible !== false,
    finalsVisible: value?.finalsVisible !== false,
  };
}

export type ClassPeriodVisibilityFormState = {
  success: boolean;
  message: string;
  period?: ClassPeriodName;
  visible?: boolean;
  fieldErrors?: Partial<Record<"classId" | "period" | "visible", string>>;
};

function singleFormValue(formData: FormData, field: string): string | null {
  const values = formData.getAll(field);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : null;
}

export function parseClassPeriodVisibilityForm(formData: FormData):
  | (ClassPeriodVisibilityFormState & { success: false })
  | { success: true; id: bigint; period: ClassPeriodName; field: ClassPeriodVisibilityField; visible: boolean } {
  const classId = singleFormValue(formData, "classId");
  const id = classId === null ? null : parseClassId(classId);
  const period = singleFormValue(formData, "period");
  const definition = classPeriodDefinitions.find((item) => item.period === period);
  const visible = singleFormValue(formData, "visible");
  const fieldErrors: NonNullable<ClassPeriodVisibilityFormState["fieldErrors"]> = {};

  if (id === null) fieldErrors.classId = "Choose a valid class.";
  if (!definition) fieldErrors.period = "Choose a valid grading period.";
  if (visible !== "true" && visible !== "false") fieldErrors.visible = "Choose whether students can see this grading period.";
  if (Object.keys(fieldErrors).length || id === null || !definition) {
    return { success: false, message: "Check the grading period settings and try again.", fieldErrors };
  }

  return { success: true, id, period: definition.period, field: definition.field, visible: visible === "true" };
}
