"use server";

import { inviteTeacher } from "@/lib/teachers/admin";
import type { TeacherFormState } from "@/lib/teachers/validation";

export async function sendTeacherSetupEmailAction(previousState: TeacherFormState, formData: FormData) {
  return inviteTeacher(previousState, formData);
}
