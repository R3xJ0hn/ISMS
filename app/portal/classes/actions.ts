"use server";

import { createClass, updateClass } from "@/lib/classes/admin";
import type { ClassFormState } from "@/lib/classes/validation";

export async function createClassAction(previousState: ClassFormState, formData: FormData) {
  return createClass(previousState, formData);
}

export async function updateClassAction(previousState: ClassFormState, formData: FormData) {
  return updateClass(previousState, formData);
}
