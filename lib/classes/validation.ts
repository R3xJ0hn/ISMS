import { capitalizeInputText, parseRecordId, readFormFields, readFormText } from "@/lib/utils";
import { validateSchoolYear } from "@/lib/validation";
import { getAcademicLevelOption, getSemesterOption } from "@/lib/academic-levels";
import { ClassStatus, type AcademicLevel, type Semester } from "@/lib/generated/prisma/enums";

export const classFields = [
  "schoolYear", "semester", "sectionName", "yearLevel", "teacherId", "programId", "subjectId", "branchId",
] as const;

export type ClassFormValues = Record<typeof classFields[number], string> & { studentIds?: string[]; status?: string };
export type ClassFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof ClassFormValues | "classId", string>>;
};

export type TeacherSpreadsheetFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<"classId" | "spreadsheetUrl", string>>;
};

type ClassFormFailure = ClassFormState & { success: false };
type ClassFormSuccess = {
  success: true;
  id?: bigint;
  data: { schoolYear: string; semester: Semester; sectionName: string; teacherId: bigint; branchId: bigint; programId: bigint; subjectId: bigint; yearLevel: AcademicLevel; status?: ClassStatus };
  studentIds?: bigint[];
};

export const parseClassId = parseRecordId;

function parseSpreadsheetUrl(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 2048 || /[\u0000-\u001f\u007f-\u009f\p{Cf}\\]/u.test(normalized)) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.port || url.username || url.password) {
      return null;
    }
    const match = /^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview|copy|export|htmlview|gviz\/tq))?\/?$/.exec(url.pathname);
    return match ? { url, spreadsheetId: match[1] } : null;
  } catch {
    return null;
  }
}

export function getSpreadsheetId(value: string): string | null {
  return parseSpreadsheetUrl(value)?.spreadsheetId ?? null;
}

export function normalizeSpreadsheetUrl(value: string): string | null {
  return parseSpreadsheetUrl(value)?.url.href ?? null;
}

export function parseTeacherSpreadsheetForm(formData: FormData):
  | (TeacherSpreadsheetFormState & { success: false })
  | { success: true; id: bigint; spreadsheetUrl: string } {
  const id = parseClassId(readFormText(formData, "classId"));
  const spreadsheetUrl = normalizeSpreadsheetUrl(readFormText(formData, "spreadsheetUrl"));
  const fieldErrors: NonNullable<TeacherSpreadsheetFormState["fieldErrors"]> = {};

  if (id === null) fieldErrors.classId = "Choose a valid class.";
  if (!spreadsheetUrl) fieldErrors.spreadsheetUrl = "Enter an HTTPS Google Sheets link from docs.google.com.";
  if (Object.keys(fieldErrors).length || id === null || !spreadsheetUrl) {
    return { success: false, message: "Check the highlighted fields.", fieldErrors };
  }
  return { success: true, id, spreadsheetUrl };
}

export function parseClassForm(
  formData: FormData,
  mode: "edit",
): ClassFormFailure | (ClassFormSuccess & { id: bigint });
export function parseClassForm(
  formData: FormData,
  mode: "create" | "edit",
): ClassFormFailure | ClassFormSuccess;
export function parseClassForm(
  formData: FormData,
  mode: "create" | "edit",
): ClassFormFailure | ClassFormSuccess {
  const values = readFormFields(formData, classFields);
  values.sectionName = capitalizeInputText(values.sectionName);
  const fieldErrors: NonNullable<ClassFormState["fieldErrors"]> = {};
  const id = mode === "edit" ? parseClassId(readFormText(formData, "classId")) : null;
  const teacherId = parseClassId(values.teacherId);
  const branchId = parseClassId(values.branchId);
  const programId = parseClassId(values.programId);
  const subjectId = parseClassId(values.subjectId);
  const yearLevel = getAcademicLevelOption(values.yearLevel)?.value;
  const semester = formData.getAll("semester").length === 1 ? getSemesterOption(values.semester)?.value : undefined;
  const statusEntries = formData.getAll("status");
  const statusInput = readFormText(formData, "status");
  const status = statusEntries.length === 0
    ? mode === "create" ? ClassStatus.ongoing : undefined
    : statusEntries.length === 1 && Object.values(ClassStatus).includes(statusInput as ClassStatus) ? statusInput as ClassStatus : undefined;
  if (statusEntries.length && !status) fieldErrors.status = "Select a valid class status.";
  let studentIds: bigint[] | undefined;
  if (formData.has("studentIds")) {
    const entries = formData.getAll("studentIds");
    const selected = entries.filter((entry) => entry !== "");
    const parsed = entries.length > 1001 ? [] : selected.map((entry) => typeof entry === "string" ? parseClassId(entry) : null);
    if (entries.length > 1001 || selected.length > 1000 || entries.length - selected.length > 1 || parsed.some((id) => id === null)) {
      fieldErrors.studentIds = "Select valid saved students, up to 1,000 per class.";
    } else {
      studentIds = [...new Set(parsed as bigint[])];
    }
  }

  if (mode === "edit" && id === null) fieldErrors.classId = "Choose a valid class.";
  if (teacherId === null) fieldErrors.teacherId = "Choose a saved teacher.";
  if (branchId === null) fieldErrors.branchId = "Choose an existing branch.";
  if (programId === null) fieldErrors.programId = "Choose a program offered by this branch.";
  if (subjectId === null) fieldErrors.subjectId = "Choose a subject assigned to this program.";
  if (!yearLevel) fieldErrors.yearLevel = "Select a valid year level.";
  if (!semester) fieldErrors.semester = "Select a valid semester.";
  if (!validateSchoolYear(values.schoolYear)) {
    fieldErrors.schoolYear = "Select a valid school year.";
  }
  for (const [field, label, maximum] of [
    ["sectionName", "section name", 150],
  ] as const) {
    if (!values[field] || values[field].length > maximum || /[\u0000-\u001f\u007f]/.test(values[field])) {
      fieldErrors[field] = `Enter the ${label} using up to ${maximum} characters.`;
    }
  }
  if (Object.keys(fieldErrors).length || teacherId === null || branchId === null || programId === null || subjectId === null || !yearLevel || !semester) {
    return { success: false, message: "Check the highlighted fields.", fieldErrors };
  }

  return {
    success: true,
    ...(id !== null ? { id } : {}),
    ...(studentIds !== undefined ? { studentIds } : {}),
    data: {
      schoolYear: values.schoolYear.replace(/\s*-\s*/g, "-"),
      semester,
      ...(status !== undefined ? { status } : {}),
      sectionName: values.sectionName,
      yearLevel,
      teacherId,
      branchId,
      programId,
      subjectId,
    },
  };
}
