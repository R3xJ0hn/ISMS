"use server";

import { updateProgram } from "@/lib/programs/admin";
import type { ProgramFormState } from "@/lib/programs/validation";

export async function updateProgramAction(previous: ProgramFormState, formData: FormData) {
  return updateProgram(previous, formData);
}
