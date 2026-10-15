"use server";

import { updateBranchPrograms } from "@/lib/branch-programs/admin";
import type { BranchProgramFormState } from "@/lib/branch-programs/validation";

export async function saveBranchProgramsAction(previous: BranchProgramFormState, formData: FormData) {
  return updateBranchPrograms(previous, formData);
}
