import { parseRecordId, readFormText } from "@/lib/utils";

export type ProgramSubjectFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<"programId" | "subjectIds", string>>;
};

export function parseProgramSubjectId(value: string) {
  return parseRecordId(value, { maxDigits: 20 });
}

export function parseProgramSubjectForm(formData: FormData):
  | (ProgramSubjectFormState & { success: false })
  | { success: true; programId: bigint; subjectIds: bigint[] } {
  const programId = parseProgramSubjectId(readFormText(formData, "programId"));
  if (programId === null) return {
    success: false, message: "Choose an existing program.", fieldErrors: { programId: "Choose a valid program." },
  };
  const entries = formData.getAll("subjectIds");
  const selections = entries.filter((entry) => entry !== "");
  const subjectIds = selections.map((entry) => typeof entry === "string" ? parseProgramSubjectId(entry) : null);
  if (!entries.length || entries.length > 1001 || entries.length - selections.length > 1 || subjectIds.some((id) => id === null)) return {
    success: false, message: "Check the selected subjects.", fieldErrors: { subjectIds: "Select existing subjects, or clear the unused selections." },
  };
  return { success: true, programId, subjectIds: [...new Set(subjectIds as bigint[])] };
}
