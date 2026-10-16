import type { LastSchoolVerificationStatus, SchoolType } from "@/lib/generated/prisma/enums";

export type LastSchoolField = "schoolIdentifier" | "schoolName" | "shortName" | "schoolType" | "street" | "barangay" | "city" | "province" | "postalCode";

export type LastSchoolFormRecord = Record<Exclude<LastSchoolField, "schoolType">, string> & {
  id: string;
  schoolType: SchoolType;
  verificationStatus: LastSchoolVerificationStatus;
};

export type LastSchoolTableRow = LastSchoolFormRecord & {
  formattedAddress: string;
  applicationCount: number;
  createdAt: string;
  reviewedAt: string | null;
};

export type LastSchoolFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<LastSchoolField, string>>;
};
