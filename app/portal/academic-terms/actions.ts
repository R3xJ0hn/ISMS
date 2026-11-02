"use server";

import { saveAcademicScheme, assignProgramScheme } from "@/lib/academics/admin";
import type { SchemeState } from "@/lib/academics/validation";

export async function saveAcademicSchemeAction(
  previous: SchemeState,
  form: FormData,
) {
  return saveAcademicScheme(previous, form);
}

export async function assignProgramSchemeAction(
  previous: SchemeState,
  form: FormData,
) {
  return assignProgramScheme(previous, form);
}
