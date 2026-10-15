import { parseRecordId, readFormText } from "@/lib/utils";

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
  const entries = formData.getAll("programIds");
  const selections = entries.filter((entry) => entry !== "");
  const programIds = selections.map((entry) => typeof entry === "string" ? parseBranchProgramId(entry) : null);
  if (!entries.length || entries.length > 1001 || entries.length - selections.length > 1 || programIds.some((id) => id === null)) return {
    success: false, message: "Check the selected programs.", fieldErrors: { programIds: "Select existing programs, or clear all selections." },
  };
  return { success: true, branchId, programIds: [...new Set(programIds as bigint[])] };
}
