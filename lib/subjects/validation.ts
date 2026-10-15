import { capitalizeInputText, parseRecordId, readFormText, sanitizeInputText } from "@/lib/utils";

export const subjectTextLimits = { name: 200, code: 50 } as const;
export type SubjectFormValues = { name: string; code: string; units: string };
export type SubjectFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof SubjectFormValues | "subjectId", string>>;
};

export const parseSubjectId = parseRecordId;

export function parseSubjectForm(formData: FormData, mode: "create" | "edit") {
  const id = mode === "edit" ? parseSubjectId(readFormText(formData, "subjectId")) : null;
  const name = capitalizeInputText(readFormText(formData, "name"));
  const code = sanitizeInputText(readFormText(formData, "code"));
  const units = readFormText(formData, "units");
  const fieldErrors: NonNullable<SubjectFormState["fieldErrors"]> = {};
  if (mode === "edit" && id === null) fieldErrors.subjectId = "Choose a valid subject.";
  if (!name) fieldErrors.name = "Enter the subject name.";
  else if (name.length > subjectTextLimits.name) fieldErrors.name = `Use ${subjectTextLimits.name} characters or fewer.`;
  if (!code) fieldErrors.code = "Enter the subject code.";
  else if (code.length > subjectTextLimits.code) fieldErrors.code = `Use ${subjectTextLimits.code} characters or fewer.`;
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(units)) fieldErrors.units = "Use a number from 0 to 99.99 with up to two decimal places.";
  if (Object.keys(fieldErrors).length) {
    return { success: false as const, message: "Check the highlighted fields.", fieldErrors };
  }
  return { success: true as const, id, data: { name, code, units } };
}
