import { parseRecordId, readFormRecordIds, readFormText } from "@/lib/utils";

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
  const subjectIds = readFormRecordIds(formData, "subjectIds");
  if (subjectIds === null) return {
    success: false, message: "Check the selected subjects.", fieldErrors: { subjectIds: "Select existing subjects, or clear the unused selections." },
  };
  return { success: true, programId, subjectIds };
}
