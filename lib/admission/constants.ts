export const NEW_STUDENT = "New Student";
export const EXISTING_STUDENT = "Existing Student";

export const allowedAcademicLevelSlugsByProgramType: Record<string, readonly string[]> = {
  Bachelor: ["first-year", "second-year", "third-year", "fourth-year"],
  SeniorHigh: ["grade-11", "grade-12"],
  Associate: ["first-year", "second-year"],
};
