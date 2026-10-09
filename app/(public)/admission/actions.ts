"use server";

import {
  getAdmissionProgramOptions as getAdmissionProgramOptionsFromServer,
  submitAdmissionApplication as submitAdmissionApplicationFromServer,
} from "@/lib/admission/server";
import { verifyExistingStudentRecord } from "@/lib/admission/student-verification";
import type { VerifyExistingStudentInput } from "@/lib/types";

export async function verifyExistingStudent(
  input: VerifyExistingStudentInput,
) {
  return verifyExistingStudentRecord(input);
}

export async function submitAdmissionApplication(
  form: Record<string, string>,
  consent: boolean
) {
  return submitAdmissionApplicationFromServer(form, consent);
}

export async function getAdmissionProgramOptions(branchId: string) {
  return getAdmissionProgramOptionsFromServer(branchId);
}
