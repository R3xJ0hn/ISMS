"use server";

import { getCachedAdmissionBranches } from "@/lib/data-access/branches";

export async function getSchoolBranches() {
  try {
    return {
      branches: await getCachedAdmissionBranches(),
    };
  } catch {
    return {
      branches: [],
      error: "Failed to fetch branches.",
    };
  }
}
