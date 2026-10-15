"use server";

import { updateProgramSubjects } from "@/lib/program-subjects/admin";
import type { ProgramSubjectFormState } from "@/lib/program-subjects/validation";

export async function saveProgramSubjectsAction(previous: ProgramSubjectFormState, formData: FormData) {
  return updateProgramSubjects(previous, formData);
}
