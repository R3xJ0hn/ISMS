import { parseRecordId, readFormRecordIds, readFormText } from "@/lib/utils";

export type BranchProgramFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<"branchId" | "programIds", string>>;
};

export function parseBranchProgramId(value: string) {
  return parseRecordId(value, { maxDigits: 20 });
}

export function parseBranchProgramForm(formData: FormData):
  | (BranchProgramFormState & { success: false })
  | { success: true; branchId: bigint; programIds: bigint[] } {
  const branchId = parseBranchProgramId(readFormText(formData, "branchId"));
  if (branchId === null) return {
    success: false, message: "Choose an existing branch.", fieldErrors: { branchId: "Choose a valid branch." },
  };
  const programIds = readFormRecordIds(formData, "programIds");
  if (programIds === null) return {
    success: false, message: "Check the selected programs.", fieldErrors: { programIds: "Select existing programs, or clear all selections." },
  };
  return { success: true, branchId, programIds };
}
