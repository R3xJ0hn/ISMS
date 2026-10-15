"use server";

import { activateTeacher } from "@/lib/teachers/activation";
import type { TeacherFormState } from "@/lib/teachers/validation";

export async function activateTeacherAction(previousState: TeacherFormState, formData: FormData) {
  return activateTeacher(previousState, formData);
}
