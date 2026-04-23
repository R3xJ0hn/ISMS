"use server";

import { getAdmissionBranches } from "@/lib/admission/server";

export async function getSchoolBranches() {
  return getAdmissionBranches();
}
