"use server";

import * as admission from "@/lib/admission/admin";

export async function addAdmittedStudentAction(
  ...args: Parameters<typeof admission.addAdmittedStudentAction>
) {
  return admission.addAdmittedStudentAction(...args);
}

export async function bulkAdmitStudentsAction(
  ...args: Parameters<typeof admission.bulkAdmitStudentsAction>
) {
  return admission.bulkAdmitStudentsAction(...args);
}

export async function editAdmittedStudentAction(
  ...args: Parameters<typeof admission.editAdmittedStudentAction>
) {
  return admission.editAdmittedStudentAction(...args);
}

export async function getAdmittedStudentDetails(applicationId: string) {
  return admission.getAdmittedStudentDetails(applicationId);
}

export async function updateApplicationStatusAction(
  ...args: Parameters<typeof admission.updateApplicationStatusAction>
) {
  return admission.updateApplicationStatusAction(...args);
}

export type {
  AddAdmittedStudentState,
  BulkAdmitStudentsState,
  EditAdmittedStudentState,
  UpdateApplicationStatusState,
} from "@/lib/admission/admin";
