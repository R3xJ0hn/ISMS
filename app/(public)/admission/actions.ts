"use server";

import {
  getAdmissionBranches as getAdmissionBranchesFromServer,
  getAdmissionProgramOptions as getAdmissionProgramOptionsFromServer,
  submitAdmissionApplication as submitAdmissionApplicationFromServer,
  verifyCurrentStudent as verifyCurrentStudentFromServer,
  type VerifyCurrentStudentInput,
} from "@/lib/admission/server";

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
