"use server";

import { createClass, updateClass } from "@/lib/classes/admin";
import { getClassRosterReviewReport } from "@/lib/classes/roster-review";
import type { ClassFormState } from "@/lib/classes/validation";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function createClassAction(previousState: ClassFormState, formData: FormData) {
  return createClass(previousState, formData);
}

export async function updateClassAction(previousState: ClassFormState, formData: FormData) {
  return updateClass(previousState, formData);
}

/** The report service authorizes access before reading records or refreshing its cache. */
export async function getClassRosterReviewAction(refresh = false) {
  try {
    const report = await getClassRosterReviewReport({ refresh: refresh === true });
    return { success: true as const, report };
  } catch (error) {
    return { success: false as const, reason: isRedirectError(error) ? "unauthorized" as const : "unavailable" as const };
  }
}
