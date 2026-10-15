import type { Address } from "./catalog";

export type AdmissionLastSchool = {
  id: string;
  schoolName: string;
  schoolId: string | null;
  shortName: string | null;
  schoolType: "Public" | "Private" | "Other";
  address: Address | null;
  formattedAddress: string;
};

export type AdmissionLastSchoolsResult = {
  schools: AdmissionLastSchool[];
  error?: string;
};
