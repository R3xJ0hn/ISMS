"use server";

import { editManagedStudentAction as editManagedStudent } from "@/lib/admission/admin";

export async function editManagedStudentAction(...args: Parameters<typeof editManagedStudent>) {
  return editManagedStudent(...args);
}
