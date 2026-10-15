"use server";

import { createSubject, updateSubject } from "@/lib/subjects/admin";
import type { SubjectFormState } from "@/lib/subjects/validation";

export async function createSubjectAction(previous: SubjectFormState, formData: FormData) {
  return createSubject(previous, formData);
}

export async function updateSubjectAction(previous: SubjectFormState, formData: FormData) {
  return updateSubject(previous, formData);
}
