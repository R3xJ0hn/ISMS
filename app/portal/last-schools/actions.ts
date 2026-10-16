"use server";

import { reviewManagedLastSchool, saveManagedLastSchool } from "@/lib/last-schools/admin";
import type { LastSchoolFormState } from "@/lib/last-schools/types";

export async function saveLastSchoolAction(_previous: LastSchoolFormState, formData: FormData) {
  return saveManagedLastSchool(formData);
}

export async function reviewLastSchoolAction(_previous: LastSchoolFormState, formData: FormData) {
  return reviewManagedLastSchool(formData);
}
