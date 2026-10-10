"use server";

import {
  submitAdmissionApplication as submitAdmissionApplicationFromServer,
  verifyCurrentStudent as verifyCurrentStudentFromServer,
} from "@/lib/admission/applications";
import {
  getAdmissionBranches as getAdmissionBranchesFromServer,
  getAdmissionProgramOptions as getAdmissionProgramOptionsFromServer,
} from "@/lib/admission/catalog";
import type { VerifyCurrentStudentInput } from "@/lib/admission/types";

export async function getAdmissionBranches() {
  return getAdmissionBranchesFromServer();
}

export async function getAdmissionProgramOptions(branchId: string) {
  return getAdmissionProgramOptionsFromServer(branchId);
}

export async function verifyCurrentStudent(input: VerifyCurrentStudentInput) {
  return verifyCurrentStudentFromServer(input);
}

export async function submitAdmissionApplication(
  form: Record<string, string>,
  consent: boolean
) {
  return submitAdmissionApplicationFromServer(form, consent);
}
