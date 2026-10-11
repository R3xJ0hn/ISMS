import { ProgramType } from "@/lib/generated/prisma/enums";
import { enumIncludes, optionalText, parseId, readFormFields, readFormText } from "@/lib/utils";

export const programFields = [
  "code", "label", "programType", "groupId", "slug", "publicTitle", "publicCode",
  "note", "overview", "focusAreas", "pathways", "sortOrder",
] as const;

export type ProgramFormValues = Record<typeof programFields[number], string>;
export type ProgramFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof ProgramFormValues, string>>;
};

function parseLines(value: string) {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

export function parseProgramForm(formData: FormData) {
  const id = parseId(readFormText(formData, "programId"));
  if (id === null || id <= 0n || id > 9223372036854775807n) {
    return { success: false as const, message: "A valid program is required." };
  }

  const values = readFormFields(formData, programFields);
  const fieldErrors: NonNullable<ProgramFormState["fieldErrors"]> = {};
  const programType = enumIncludes(ProgramType, values.programType) ? values.programType : null;
  if (!values.code) fieldErrors.code = "Enter the program code.";
  if (!values.label) fieldErrors.label = "Enter the program name.";
  if (!programType) {
    fieldErrors.programType = "Choose a valid program type.";
  }
  if (values.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) {
    fieldErrors.slug = "Use lowercase letters, numbers, and single hyphens.";
  }
  if (values.groupId) {
    for (const [field, label] of [
      ["slug", "course URL"], ["publicTitle", "public title"],
      ["publicCode", "public code"], ["overview", "overview"],
    ] as const) {
      if (!values[field]) fieldErrors[field] = `Enter the ${label} to list this program publicly.`;
    }
  }
  const sortOrder = /^\d+$/.test(values.sortOrder) ? Number(values.sortOrder) : NaN;
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 2147483647) {
    fieldErrors.sortOrder = "Use a whole number from 0 to 2147483647.";
  }
  if (Object.keys(fieldErrors).length || !programType) {
    return { success: false as const, message: "Check the highlighted fields.", fieldErrors };
  }

  return {
    success: true as const,
    id,
    data: {
      code: values.code,
      label: values.label,
      programType,
      groupId: optionalText(values.groupId),
      slug: optionalText(values.slug),
      publicTitle: optionalText(values.publicTitle),
      publicCode: optionalText(values.publicCode),
      note: optionalText(values.note),
      overview: optionalText(values.overview),
      focusAreas: parseLines(values.focusAreas),
      pathways: parseLines(values.pathways),
      sortOrder,
    },
  };
}
