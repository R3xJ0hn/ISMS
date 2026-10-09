import type { SchoolBranchSummary } from "./branches";

export type AdmissionAcademicLevelOption = {
  id: string;
  label: string;
  slug: string;
};

export type AdmissionProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: AdmissionAcademicLevelOption[];
};

export type AdmissionProgramOptionsResult = {
  branch?: SchoolBranchSummary;
  programs: AdmissionProgramOption[];
  error?: string;
};

export type InternalProgramOption = {
  id: string;
  code: string;
  label: string;
  programType: string;
  academicLevels: Map<string, AdmissionAcademicLevelOption>;
};
