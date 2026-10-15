"use server";

import { updateClassSpreadsheet, updateClassPeriodVisibility } from "@/lib/classes/teacher";
import type { TeacherSpreadsheetFormState } from "@/lib/classes/validation";
import type { ClassPeriodVisibilityFormState } from "@/lib/classes/period-visibility";

export async function saveClassSpreadsheetAction(previousState: TeacherSpreadsheetFormState, formData: FormData) {
  return updateClassSpreadsheet(previousState, formData);
}

export async function saveClassPeriodVisibilityAction(previousState: ClassPeriodVisibilityFormState, formData: FormData) {
  return updateClassPeriodVisibility(previousState, formData);
}
