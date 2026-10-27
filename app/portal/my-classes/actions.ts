"use server";

import { removeClassSpreadsheet, updateClassSpreadsheet, updateClassPeriodVisibility } from "@/lib/classes/teacher";
import type { TeacherSpreadsheetFormState, TeacherSpreadsheetRemovalFormState } from "@/lib/classes/validation";
import type { ClassPeriodVisibilityFormState } from "@/lib/classes/period-visibility";

export async function saveClassSpreadsheetAction(previousState: TeacherSpreadsheetFormState, formData: FormData) {
  return updateClassSpreadsheet(previousState, formData);
}

export async function removeClassSpreadsheetAction(previousState: TeacherSpreadsheetRemovalFormState, formData: FormData) {
  return removeClassSpreadsheet(previousState, formData);
}

export async function saveClassPeriodVisibilityAction(previousState: ClassPeriodVisibilityFormState, formData: FormData) {
  return updateClassPeriodVisibility(previousState, formData);
}
