import { getSpreadsheetId } from "./validation";

export type ClassSummaryStudent = {
  studentNumber: string;
  studentName: string;
  prelim: string | null;
  midterm: string | null;
  prefinals: string | null;
  finals: string | null;
  average: string | null;
  remarks: string | null;
  note: string | null;
};

export type ClassSummaryResult =
  | { success: true; students: ClassSummaryStudent[] }
  | { success: false; message: string };

export type ClassRosterStudent = {
  rowNumber: number;
  studentNumber: string;
  studentName: string;
};

export type ClassRosterResult =
  | { success: true; students: ClassRosterStudent[] }
  | { success: false; message: string };

export type ClassworkActivity = {
  name: string;
  maxScore: number;
  isExcludable: boolean;
  score?: string | null;
};

export type ClassworkCategory = {
  name: string;
  weight: number | null;
  activities: ClassworkActivity[];
};

export type ClassworkPeriod = {
  period: "Prelim" | "Midterm" | "Prefinals" | "Finals";
  categories: ClassworkCategory[];
};

export type ClassworkCatalogResult =
  | { success: true; periods: ClassworkPeriod[] }
  | { success: false; message: string };

export type StudentClassworkResult =
  | { success: true; record: ClassSummaryStudent; periods: ClassworkPeriod[] }
  | { success: false; message: string; code?: StudentRecordErrorCode };

export type StudentRecordErrorCode = "STUDENT_NUMBER_NOT_FOUND" | "STUDENT_REPORT_NOT_FOUND" | "STUDENT_RECORD_AMBIGUOUS";

const unavailableMessage = "Unable to load this class summary. Please try again later.";
const malformedMessage = "The spreadsheet returned an incomplete class summary. Ask an administrator to check the spreadsheet connection.";
const classworkUnavailableMessage = "Unable to load classwork from this class spreadsheet. Please try again later.";
const classworkMalformedMessage = "The spreadsheet returned incomplete classwork. Ask an administrator to check the spreadsheet connection.";
const rosterUnavailableMessage = "Unable to load the class roster from this spreadsheet. Please try again later.";
const rosterMalformedMessage = "The spreadsheet returned an incomplete class roster. Check the spreadsheet connection and its Apps Script deployment.";
const rosterUpgradeMessage = "This spreadsheet service does not support class rosters yet. Update and redeploy the Apps Script service, then try again.";
const recordsHiddenMessage = "This class has not enabled spreadsheet records in the portal.";

type Failure = { success: false; message: string; code?: StudentRecordErrorCode };
type ScriptAction = "all_students" | "all_classworks" | "student" | "class_roster";
type SpreadsheetSettings = {
  viewRecords: boolean;
  viewExcluded: boolean;
};

function failure(message: string): Failure {
  return { success: false, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scriptEndpoint(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "script.google.com" || url.port ||
      url.username || url.password || url.search || url.hash ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function field(record: Record<string, unknown>, aliases: string[]) {
  for (const name of aliases) {
    if (Object.hasOwn(record, name)) return record[name];
  }
  return undefined;
}

function displayValue(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function gradeFields(record: Record<string, unknown>): Record<string, unknown> | null {
  if (!Object.hasOwn(record, "grades")) return record;
  if (!Array.isArray(record.grades)) return null;
  const aliases: Record<string, string> = {
    prelim: "prelim", midterm: "midterm", prefinals: "prefinals", finals: "finals",
    ave: "average", average: "average", remarks: "remarks", note: "note",
  };
  const values: Record<string, unknown> = {};
  for (const grade of record.grades) {
    if (!isObject(grade) || typeof grade.Label !== "string" || !Object.hasOwn(grade, "Value")) return null;
    const label = grade.Label.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (!Object.hasOwn(aliases, label)) continue;
    const key = aliases[label];
    if (Object.hasOwn(values, key)) return null;
    values[key] = grade.Value;
  }
  return values;
}

function providerFailure(error: unknown): ClassSummaryResult {
  if (error === "Invalid request" || error === "Unsupported action") {
    return failure("The spreadsheet connection does not support class summaries yet. Ask an administrator to update the spreadsheet service.");
  }
  if (error === "Unauthorized") {
    return failure("Unable to access this class spreadsheet. Ask an administrator to check the connection.");
  }
  const messages: Record<string, string> = {
    "Worksheet not found": "The spreadsheet service could not find the class worksheet. Ask an administrator to check the spreadsheet connection.",
    "INPUT sheet not found": "The spreadsheet is missing its INPUT sheet.",
    "REPORT sheet not found": "The spreadsheet is missing its REPORT sheet.",
    "Incomplete student records in INPUT": "The INPUT sheet has a student record without a name or student number.",
    "Duplicate student number in INPUT": "The INPUT sheet has duplicate student numbers. Correct them before loading the summary.",
    "Duplicate student name in INPUT": "The INPUT sheet has duplicate student names, so grades cannot be matched safely.",
    "Duplicate student name in REPORT": "The REPORT sheet has duplicate student names, so grades cannot be matched safely.",
    "Student missing from REPORT": "A student in the INPUT sheet is missing from REPORT. Check the spreadsheet before loading the summary.",
  };
  if (typeof error === "string") {
    if (Object.hasOwn(messages, error)) return failure(messages[error]);
    if (error.startsWith("Duplicate student number:")) return failure(messages["Duplicate student number in INPUT"]);
    if (error.startsWith("Duplicate name in INPUT:")) return failure(messages["Duplicate student name in INPUT"]);
    if (error.startsWith("Duplicate student in REPORT:")) return failure(messages["Duplicate student name in REPORT"]);
  }
  return failure(unavailableMessage);
}

function summaryResponse(payload: unknown): ClassSummaryResult {
  if (!isObject(payload)) return failure(malformedMessage);
  if (payload.success === false) return providerFailure(payload.error);
  if (Object.hasOwn(payload, "action") && payload.action !== "all_students") return failure(malformedMessage);
  if (Object.hasOwn(payload, "settings")) {
    if (!isObject(payload.settings) ||
      (Object.hasOwn(payload.settings, "view_records_in_web_portal") &&
        typeof payload.settings.view_records_in_web_portal !== "boolean")) return failure(malformedMessage);
    if (payload.settings.view_records_in_web_portal === false) return failure(recordsHiddenMessage);
  }
  if (payload.success !== true || !isObject(payload.data) || !Array.isArray(payload.data.students)) {
    return failure(malformedMessage);
  }
  if (Object.hasOwn(payload.data, "total_students") &&
    payload.data.total_students !== payload.data.students.length) return failure(malformedMessage);

  const students: ClassSummaryStudent[] = [];
  const studentNumbers = new Set<string>();
  const studentNames = new Set<string>();
  for (const record of payload.data.students) {
    if (!isObject(record)) return failure(malformedMessage);
    const studentNumber = field(record, ["student_num", "studentNumber"]);
    const studentName = field(record, ["student_name", "studentName"]);
    if (typeof studentNumber !== "string" ||
      typeof studentName !== "string" || !studentName.trim()) return failure(malformedMessage);
    const normalizedNumber = studentNumber.trim();
    const normalizedName = studentName.trim().toUpperCase().replace(/\s+/g, " ");
    if ((normalizedNumber && studentNumbers.has(normalizedNumber)) || studentNames.has(normalizedName)) {
      return failure("The spreadsheet returned duplicate student records. Check the student numbers and names before loading the summary.");
    }
    if (normalizedNumber) studentNumbers.add(normalizedNumber);
    studentNames.add(normalizedName);

    const grades = gradeFields(record);
    if (!grades) return failure(malformedMessage);
    const values = {
      prelim: displayValue(field(grades, ["prelim"])),
      midterm: displayValue(field(grades, ["midterm"])),
      prefinals: displayValue(field(grades, ["prefinals", "pre_finals"])),
      finals: displayValue(field(grades, ["finals"])),
      average: displayValue(field(grades, ["average", "ave"])),
      remarks: displayValue(field(grades, ["remarks"])),
      note: displayValue(field(grades, ["note"])),
    };
    if (Object.values(values).some((value) => value === undefined)) return failure(malformedMessage);
    students.push({ studentNumber: normalizedNumber, studentName: studentName.trim(), ...values } as ClassSummaryStudent);
  }
  return { success: true, students };
}

async function requestSpreadsheet(
  spreadsheetUrl: string,
  action: ScriptAction,
  studentNumber?: string,
): Promise<{ success: true; payload: unknown } | Failure> {
  const classwork = action !== "all_students";
  const roster = action === "class_roster";
  const requestUnavailableMessage = roster ? rosterUnavailableMessage : classwork ? classworkUnavailableMessage : unavailableMessage;
  const spreadsheetId = getSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId) return failure("This class does not have a valid Google Sheets link. Ask an administrator to check it.");
  const endpoint = scriptEndpoint(process.env.GOOGLE_SCRIPT_URL);
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (!endpoint || !secret) {
    return failure(roster
      ? "Class rosters are not configured. Ask an administrator to set up the spreadsheet connection."
      : classwork
      ? "Classwork is not configured. Ask an administrator to set up the spreadsheet connection."
      : "Class summaries are not configured. Ask an administrator to set up the spreadsheet connection.");
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ secret, spreadsheetId, action, ...(studentNumber !== undefined ? { studentNum: studentNumber } : {}) }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return failure(requestUnavailableMessage);
    return { success: true, payload: await response.json() };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return failure("The class spreadsheet took too long to respond. Please try again.");
    }
    return failure(requestUnavailableMessage);
  }
}

function rosterResponse(payload: unknown): ClassRosterResult {
  if (!isObject(payload)) return failure(rosterMalformedMessage);
  if (payload.success === false) {
    if (payload.code === "UNSUPPORTED_ACTION" || payload.error === "Unsupported action" || payload.error === "Invalid request") {
      return failure(rosterUpgradeMessage);
    }
    if (payload.error === "Unauthorized") return failure("Unable to access this class spreadsheet. Ask an administrator to check the connection.");
    if (payload.error === "INPUT sheet not found") return failure("The spreadsheet is missing its INPUT sheet.");
    if (payload.error === "Request could not be completed") {
      return failure("Unable to load the class roster. Check the spreadsheet connection, or update and redeploy the Apps Script service if it uses an older deployment.");
    }
    return failure(rosterUnavailableMessage);
  }
  if (payload.success !== true || payload.action !== "class_roster" || !isObject(payload.settings) ||
    typeof payload.settings.view_records_in_web_portal !== "boolean" ||
    typeof payload.settings.view_excluded_columns_in_web_portal !== "boolean" ||
    !isObject(payload.data) || !Array.isArray(payload.data.students) ||
    !Number.isSafeInteger(payload.data.total_students) || payload.data.total_students !== payload.data.students.length) {
    return failure(rosterMalformedMessage);
  }
  if (!payload.settings.view_records_in_web_portal) return failure(recordsHiddenMessage);
  const students: ClassRosterStudent[] = [];
  let previousRow = 10;
  for (const student of payload.data.students) {
    if (!isObject(student) || typeof student.row_number !== "number" ||
      !Number.isSafeInteger(student.row_number) || student.row_number <= previousRow ||
      typeof student.student_num !== "string" || typeof student.student_name !== "string") {
      return failure(rosterMalformedMessage);
    }
    const studentNumber = student.student_num.trim();
    const studentName = student.student_name.trim();
    if (!studentNumber && !studentName) return failure(rosterMalformedMessage);
    previousRow = student.row_number;
    students.push({ rowNumber: student.row_number, studentNumber, studentName });
  }
  return { success: true, students };
}

/** Read INPUT identities directly; grade-report matching must not hide roster problems. */
export async function getClassRoster(spreadsheetUrl: string): Promise<ClassRosterResult> {
  const response = await requestSpreadsheet(spreadsheetUrl, "class_roster");
  return response.success ? rosterResponse(response.payload) : response;
}

export async function getClassSummary(spreadsheetUrl: string): Promise<ClassSummaryResult> {
  const result = await requestSpreadsheet(spreadsheetUrl, "all_students");
  return result.success ? summaryResponse(result.payload) : result;
}

function classworkEnvelope(payload: unknown, action: "all_classworks" | "student"):
  | { success: true; data: Record<string, unknown>; settings: SpreadsheetSettings }
  | Failure {
  if (!isObject(payload)) return failure(classworkMalformedMessage);
  if (payload.success === false) {
    if (action === "student") {
      const messages: Record<StudentRecordErrorCode, string> = {
        STUDENT_NUMBER_NOT_FOUND: "Your student number is not listed in this class spreadsheet. Ask your teacher to add or correct it.",
        STUDENT_REPORT_NOT_FOUND: "Your grade record is not available in this class spreadsheet yet. Ask your teacher to check the REPORT sheet.",
        STUDENT_RECORD_AMBIGUOUS: "Your spreadsheet records cannot be matched safely. Ask your teacher to correct duplicate student records.",
      };
      if (typeof payload.code === "string" && Object.hasOwn(messages, payload.code)) {
        const code = payload.code as StudentRecordErrorCode;
        return { success: false, message: messages[code], code };
      }
    }
    return failure(classworkUnavailableMessage);
  }
  if (payload.success !== true || payload.action !== action || !isObject(payload.data) ||
    !isObject(payload.settings) ||
    typeof payload.settings.view_records_in_web_portal !== "boolean" ||
    typeof payload.settings.view_excluded_columns_in_web_portal !== "boolean") {
    return failure(classworkMalformedMessage);
  }
  if (!payload.settings.view_records_in_web_portal) return failure(recordsHiddenMessage);
  return {
    success: true,
    data: payload.data,
    settings: {
      viewRecords: payload.settings.view_records_in_web_portal,
      viewExcluded: payload.settings.view_excluded_columns_in_web_portal,
    },
  };
}

function classworkPeriods(value: unknown, settings: SpreadsheetSettings, includeScores: boolean): ClassworkPeriod[] | null {
  if (!Array.isArray(value)) return null;
  const periodNames = ["Prelim", "Midterm", "Prefinals", "Finals"] as const;
  const seen = new Set<string>();
  const periods: ClassworkPeriod[] = [];
  for (const rawPeriod of value) {
    if (!isObject(rawPeriod) || typeof rawPeriod.period !== "string" ||
      !periodNames.includes(rawPeriod.period as ClassworkPeriod["period"]) ||
      seen.has(rawPeriod.period) || !Array.isArray(rawPeriod.categories)) return null;
    seen.add(rawPeriod.period);
    const categories: ClassworkCategory[] = [];
    for (const rawCategory of rawPeriod.categories) {
      if (!isObject(rawCategory) || typeof rawCategory.name !== "string" || !rawCategory.name.trim() ||
        !Array.isArray(rawCategory.activities) ||
        (rawCategory.weight !== null && (typeof rawCategory.weight !== "number" ||
          !Number.isFinite(rawCategory.weight) || rawCategory.weight < 0 || rawCategory.weight > 100))) return null;
      const activities: ClassworkActivity[] = [];
      for (const rawActivity of rawCategory.activities) {
        if (!isObject(rawActivity) || typeof rawActivity.name !== "string" || !rawActivity.name.trim() ||
          typeof rawActivity.max_score !== "number" || !Number.isFinite(rawActivity.max_score) || rawActivity.max_score <= 0 ||
          typeof rawActivity.is_excludable !== "boolean") return null;
        const name = rawActivity.name.replace(/`/g, "").trim();
        if (!name) return null;
        const isExcludable = rawActivity.is_excludable || rawActivity.name.includes("`");
        if (isExcludable && !settings.viewExcluded) continue;
        const activity: ClassworkActivity = { name, maxScore: rawActivity.max_score, isExcludable };
        if (includeScores) {
          const score = displayValue(rawActivity.score);
          if (score === undefined) return null;
          activity.score = score;
        }
        activities.push(activity);
      }
      categories.push({ name: rawCategory.name.trim(), weight: rawCategory.weight as number | null, activities });
    }
    periods.push({ period: rawPeriod.period as ClassworkPeriod["period"], categories });
  }
  // The script returns all four periods, including an empty catalog for a missing sheet.
  if (seen.size !== periodNames.length) return null;
  return periodNames.map((name) => periods.find((period) => period.period === name)!);
}

export async function getClassworkCatalog(spreadsheetUrl: string): Promise<ClassworkCatalogResult> {
  const response = await requestSpreadsheet(spreadsheetUrl, "all_classworks");
  if (!response.success) return response;
  const envelope = classworkEnvelope(response.payload, "all_classworks");
  if (!envelope.success) return envelope;
  const periods = classworkPeriods(envelope.data.periods, envelope.settings, false);
  return periods ? { success: true, periods } : failure(classworkMalformedMessage);
}

export async function getStudentClasswork(spreadsheetUrl: string, studentNumber: string): Promise<StudentClassworkResult> {
  const number = studentNumber.trim();
  if (!number) return failure("A student number is required to load your spreadsheet records.");
  const response = await requestSpreadsheet(spreadsheetUrl, "student", number);
  if (!response.success) return response;
  const envelope = classworkEnvelope(response.payload, "student");
  if (!envelope.success) return envelope;
  // Student numbers are identifiers: preserve leading zeros and letter case; never match by name.
  if (typeof envelope.data.student_num !== "string" || envelope.data.student_num.trim() !== number) {
    return failure(classworkMalformedMessage);
  }
  const summary = summaryResponse({ success: true, data: { students: [envelope.data] } });
  if (!summary.success) return failure(classworkMalformedMessage);
  const periods = classworkPeriods(envelope.data.periods, envelope.settings, true);
  return periods ? { success: true, record: summary.students[0], periods } : failure(classworkMalformedMessage);
}
