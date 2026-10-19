import type { ApplicationStatus, LastSchoolVerificationStatus, SchoolType } from "@/lib/generated/prisma/enums";

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

export type LastSchoolStudentRow = {
  applicationId: string;
  name: string;
  studentNumber: string | null;
  branch: string;
  program: string;
  applicationStatus: ApplicationStatus;
};

export type LastSchoolStudentsPage = {
  school: { id: string; schoolName: string };
  students: LastSchoolStudentRow[];
  query: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
