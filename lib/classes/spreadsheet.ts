import type { ClassCalendar } from "@/lib/academics/calendar";
import { getSpreadsheetId } from "./validation";
import { isAdditionalPointsActivity } from "./presentation";
import {
  getSpreadsheetErrorMessage,
  getSpreadsheetProviderErrorCode,
  getStudentSpreadsheetErrorMessage,
  type SpreadsheetErrorCode,
} from "./spreadsheet-errors";

export type ClassSummaryStudent = {
  studentNumber: string;
  studentName: string;
  periodGrades: Record<string, string | null>;
  periods: { key: string; name: string }[];
  average: string | null;
  remarks: string | null;
  note: string | null;
};

export type ClassSummaryResult =
  | { success: true; students: ClassSummaryStudent[] }
  | Failure;

export type ClassRosterStudent = {
  rowNumber: number;
  studentNumber: string;
  studentName: string;
};

export type ClassRosterResult =
  | { success: true; students: ClassRosterStudent[] }
  | Failure;

export type ClassworkActivity = {
  name: string;
  maxScore: number | null;
  isAdditionalPoints?: boolean;
  isExcludable: boolean;
  score?: string | null;
};

export type ClassworkCategory = {
  name: string;
  weight: number | null;
  activities: ClassworkActivity[];
};

export type ClassworkPeriod = {
  note?: string | null;
  period: string;
  key: string;
  categories: ClassworkCategory[];
};

export type ClassworkCatalogResult =
  | { success: true; periods: ClassworkPeriod[] }
  | Failure;

export type StudentClassworkResult =
  | { success: true; record: ClassSummaryStudent; periods: ClassworkPeriod[] }
  | Failure;

export type StudentRecordErrorCode =
  | "STUDENT_NUMBER_NOT_FOUND"
  | "STUDENT_REPORT_NOT_FOUND"
  | "STUDENT_RECORD_AMBIGUOUS";

const unavailableMessage =
  "Unable to load this class summary. Please try again later.";
const malformedMessage =
  "The spreadsheet returned an incomplete class summary. Ask an administrator to check the spreadsheet connection.";
const classworkUnavailableMessage =
  "Unable to load classwork from this class spreadsheet. Please try again later.";
const classworkMalformedMessage =
  "The spreadsheet returned incomplete classwork. Ask an administrator to check the spreadsheet connection.";
const rosterUnavailableMessage =
  "Unable to load the class roster from this spreadsheet. Please try again later.";
const rosterMalformedMessage =
  "The spreadsheet returned an incomplete class roster. Check the spreadsheet connection and its Apps Script deployment.";
const rosterUpgradeMessage =
  "This spreadsheet service does not support class rosters yet. Update and redeploy the Apps Script service, then try again.";
const unexpectedResponseMessage =
  "Unable to load spreadsheet records because the service returned an unexpected response. Ask an administrator to check the Apps Script deployment URL and response.";

type Failure = { success: false; message: string; code?: SpreadsheetErrorCode };
type ScriptAction =
  | "all_students"
  | "all_classworks"
  | "student"
  | "class_roster";
type SpreadsheetSettings = {
  viewRecords: boolean;
  viewExcluded: boolean;
};

function failure(message: string, code?: SpreadsheetErrorCode): Failure {
  return { success: false, message, ...(code ? { code } : {}) };
}

function codedFailure(code: SpreadsheetErrorCode, student = false): Failure {
  return failure(
    (student
      ? getStudentSpreadsheetErrorMessage(code)
      : getSpreadsheetErrorMessage(code))!,
    code,
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scriptEndpoint(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "script.google.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)
    )
      return null;
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

function gradeFields(
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!Array.isArray(record.grades)) return null;
  const values: Record<string, unknown> = Object.create(null);
  for (const grade of record.grades) {
    if (
      !isObject(grade) ||
      typeof grade.Label !== "string" ||
      !Object.hasOwn(grade, "Value")
    )
      return null;
    const key = grade.Label.trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");
    if (Object.hasOwn(values, key)) return null;
    values[key] = grade.Value;
  }
  return values;
}
const labelKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "");
function providerFailure(
  payload: Record<string, unknown>,
  action: ScriptAction,
): Failure {
  const code = getSpreadsheetProviderErrorCode(payload.code, payload.error);
  const studentOnly =
    code === "STUDENT_NUMBER_REQUIRED" ||
    code === "STUDENT_NUMBER_NOT_FOUND" ||
    code === "STUDENT_REPORT_NOT_FOUND" ||
    code === "STUDENT_RECORD_AMBIGUOUS";
  if (code && (!studentOnly || action === "student"))
    return codedFailure(code, action === "student");
  if (
    payload.code === "UNSUPPORTED_ACTION" ||
    payload.error === "Invalid request" ||
    payload.error === "Unsupported action"
  ) {
    return failure(
      action === "class_roster"
        ? rosterUpgradeMessage
        : action === "all_students"
          ? "The spreadsheet connection does not support class summaries yet. Ask an administrator to update the spreadsheet service."
          : "This spreadsheet service does not support classwork yet. Update and redeploy the Apps Script service, then refresh.",
    );
  }
  const messages: Record<string, string> = {
    "Worksheet not found":
      "The spreadsheet service could not find the class worksheet. Ask an administrator to check the spreadsheet connection.",
    "INPUT sheet not found": "The spreadsheet is missing its INPUT sheet.",
    "REPORT sheet not found": "The spreadsheet is missing its REPORT sheet.",
  };
  const error = payload.error;
  if (typeof error === "string") {
    if (Object.hasOwn(messages, error)) return failure(messages[error]);
    if (
      action === "class_roster" &&
      error === "Request could not be completed"
    ) {
      return failure(
        "Unable to load the class roster. Check the spreadsheet connection, or update and redeploy the Apps Script service if it uses an older deployment.",
      );
    }
  }
  return failure(
    action === "class_roster"
      ? rosterUnavailableMessage
      : action === "all_students"
        ? unavailableMessage
        : classworkUnavailableMessage,
  );
}

function summaryResponse(
  payload: unknown,
  calendar: ClassCalendar,
): ClassSummaryResult {
  if (!isObject(payload)) return failure(malformedMessage);
  if (payload.success === false)
    return providerFailure(payload, "all_students");
  if (Object.hasOwn(payload, "action") && payload.action !== "all_students")
    return failure(malformedMessage);
  if (Object.hasOwn(payload, "settings")) {
    if (
      !isObject(payload.settings) ||
      (Object.hasOwn(payload.settings, "view_records_in_web_portal") &&
        typeof payload.settings.view_records_in_web_portal !== "boolean")
    )
      return failure(malformedMessage);
    if (payload.settings.view_records_in_web_portal === false)
      return codedFailure("RECORDS_DISABLED");
  }
  if (
    payload.success !== true ||
    !isObject(payload.data) ||
    !Array.isArray(payload.data.students)
  ) {
    return failure(malformedMessage);
  }
  if (
    Object.hasOwn(payload.data, "total_students") &&
    payload.data.total_students !== payload.data.students.length
  )
    return failure(malformedMessage);

  const students: ClassSummaryStudent[] = [];
  const studentNumbers = new Set<string>();
  const studentNames = new Set<string>();
  for (const record of payload.data.students) {
    if (!isObject(record)) return failure(malformedMessage);
    const studentNumber = field(record, ["student_num", "studentNumber"]);
    const studentName = field(record, ["student_name", "studentName"]);
    if (
      typeof studentNumber !== "string" ||
      typeof studentName !== "string" ||
      !studentName.trim()
    )
      return failure(malformedMessage);
    const normalizedNumber = studentNumber.trim();
    const normalizedName = studentName
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (
      (normalizedNumber && studentNumbers.has(normalizedNumber)) ||
      studentNames.has(normalizedName)
    ) {
      return failure(
        "The spreadsheet returned duplicate student records. Check the student numbers and names before loading the summary.",
      );
    }
    if (normalizedNumber) studentNumbers.add(normalizedNumber);
    studentNames.add(normalizedName);

    const grades = gradeFields(record);
    if (!grades) return failure(malformedMessage);
    const periodGrades: Record<string, string | null> = {};
    for (const period of calendar.periods) {
      const value = displayValue(
        grades[labelKey(period.key)] ?? grades[labelKey(period.name)] ?? null,
      );
      // Missing configured grades must never look like a valid new-curriculum response.
      if (
        !Object.hasOwn(grades, labelKey(period.key)) &&
        !Object.hasOwn(grades, labelKey(period.name))
      )
        return codedFailure("CALENDAR_UPGRADE_REQUIRED");
      if (value === undefined) return failure(malformedMessage);
      periodGrades[period.key] = value;
    }
    const values = {
      average: displayValue(grades.average ?? grades.ave ?? null),
      remarks: displayValue(grades.equivalent ?? grades.remarks ?? null),
      note: displayValue(grades.note ?? null),
    };
    if (Object.values(values).some((value) => value === undefined))
      return failure(malformedMessage);
    students.push({
      studentNumber: normalizedNumber,
      studentName: studentName.trim(),
      periodGrades,
      periods: calendar.periods.map(({ key, name }) => ({ key, name })),
      ...values,
    } as ClassSummaryStudent);
  }
  return { success: true, students };
}

const htmlPrefixLength = 64 * 1024;

/** Retain only a bounded HTML diagnostic prefix without limiting valid JSON summaries. */
async function responseText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      text += decoder.decode(value, { stream: true });
      if (/^\s*</u.test(text) && text.length >= htmlPrefixLength) {
        await reader.cancel();
        return text.slice(0, htmlPrefixLength);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function googleAccessErrorCode(
  value: string,
): "SCRIPT_ACCESS_DENIED" | "SPREADSHEET_ACCESS_DENIED" | null {
  const html = value.slice(0, htmlPrefixLength);
  if (!/^\s*</u.test(html)) return null;
  const googlePage =
    /(?:accounts|docs|drive|script)\.google\.com(?:\/|["'])|Google (?:Drive|Apps Script|Accounts)/iu.test(
      html,
    );
  if (!googlePage) return null;
  const loginPage =
    /<title[^>]*>\s*Sign in[^<]*Google/iu.test(html) ||
    /<form\b[^>]*action=["']https:\/\/accounts\.google\.com\//iu.test(html);
  if (loginPage) return "SCRIPT_ACCESS_DENIED";
  const documentDenied =
    /you (?:do not|don['’]t) have permission to access the requested document|wala kang pahintulot na i-access ang hiniling na dokumento/iu.test(
      html,
    ) ||
    (/Google Drive|(?:docs|drive)\.google\.com\//iu.test(html) &&
      /you (?:need access|need permission|don['’]t have access)/iu.test(html));
  if (documentDenied) return "SPREADSHEET_ACCESS_DENIED";
  const deniedPage =
    /you (?:need access|need permission|do not have (?:access|permission)|don['’]t have (?:access|permission))|access denied|wala kang pahintulot na i-access/iu.test(
      html,
    );
  return deniedPage ? "SCRIPT_ACCESS_DENIED" : null;
}

async function requestSpreadsheet(
  spreadsheetUrl: string,
  action: ScriptAction,
  studentNumber?: string,
  calendar?: ClassCalendar,
): Promise<{ success: true; payload: unknown } | Failure> {
  const classwork = action !== "all_students";
  const roster = action === "class_roster";
  const requestUnavailableMessage = roster
    ? rosterUnavailableMessage
    : classwork
      ? classworkUnavailableMessage
      : unavailableMessage;
  const spreadsheetId = getSpreadsheetId(spreadsheetUrl);
  if (!spreadsheetId)
    return failure(
      "This class does not have a valid Google Sheets link. Ask an administrator to check it.",
    );
  const endpoint = scriptEndpoint(process.env.GOOGLE_SCRIPT_URL);
  const secret = process.env.GOOGLE_SCRIPT_SECRET;
  if (!endpoint || !secret) {
    return failure(
      roster
        ? "Class rosters are not configured. Ask an administrator to set up the spreadsheet connection."
        : classwork
          ? "Classwork is not configured. Ask an administrator to set up the spreadsheet connection."
          : "Class summaries are not configured. Ask an administrator to set up the spreadsheet connection.",
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({
        secret,
        spreadsheetId,
        action,
        ...(calendar
          ? {
              calendar: {
                periods: calendar.periods.map(
                  ({ key, name, worksheetName, reportColumn }) => ({
                    key,
                    name,
                    sheet: worksheetName,
                    reportColumn,
                  }),
                ),
                averageColumn: calendar.averageColumn,
                equivalentColumn: calendar.equivalentColumn,
              },
            }
          : {}),
        ...(studentNumber !== undefined ? { studentNum: studentNumber } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403)
      return codedFailure("SCRIPT_ACCESS_DENIED", action === "student");
    if (!response.ok) return failure(requestUnavailableMessage);
    const text = await responseText(response);
    try {
      return { success: true, payload: JSON.parse(text) as unknown };
    } catch {
      const code = googleAccessErrorCode(text);
      return code
        ? codedFailure(code, action === "student")
        : failure(unexpectedResponseMessage);
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      return failure(
        "The class spreadsheet took too long to respond. Please try again.",
      );
    }
    return failure(requestUnavailableMessage);
  }
}

function rosterResponse(payload: unknown): ClassRosterResult {
  if (!isObject(payload)) return failure(rosterMalformedMessage);
  if (payload.success === false)
    return providerFailure(payload, "class_roster");
  if (
    payload.success !== true ||
    payload.action !== "class_roster" ||
    !isObject(payload.settings) ||
    typeof payload.settings.view_records_in_web_portal !== "boolean" ||
    typeof payload.settings.view_excluded_columns_in_web_portal !== "boolean"
  )
    return failure(rosterMalformedMessage);
  if (!payload.settings.view_records_in_web_portal)
    return codedFailure("RECORDS_DISABLED");
  if (
    !isObject(payload.data) ||
    !Array.isArray(payload.data.students) ||
    !Number.isSafeInteger(payload.data.total_students) ||
    payload.data.total_students !== payload.data.students.length
  ) {
    return failure(rosterMalformedMessage);
  }
  const students: ClassRosterStudent[] = [];
  let previousRow = 10;
  for (const student of payload.data.students) {
    if (
      !isObject(student) ||
      typeof student.row_number !== "number" ||
      !Number.isSafeInteger(student.row_number) ||
      student.row_number <= previousRow ||
      typeof student.student_num !== "string" ||
      typeof student.student_name !== "string"
    ) {
      return failure(rosterMalformedMessage);
    }
    const studentNumber = student.student_num.trim();
    const studentName = student.student_name.trim();
    if (!studentNumber && !studentName) return failure(rosterMalformedMessage);
    previousRow = student.row_number;
    students.push({
      rowNumber: student.row_number,
      studentNumber,
      studentName,
    });
  }
  return { success: true, students };
}

/** Read INPUT identities directly; grade-report matching must not hide roster problems. */
export async function getClassRoster(
  spreadsheetUrl: string,
): Promise<ClassRosterResult> {
  const response = await requestSpreadsheet(spreadsheetUrl, "class_roster");
  return response.success ? rosterResponse(response.payload) : response;
}

export async function getClassSummary(
  spreadsheetUrl: string,
  calendar: ClassCalendar,
): Promise<ClassSummaryResult> {
  const result = await requestSpreadsheet(
    spreadsheetUrl,
    "all_students",
    undefined,
    calendar,
  );
  if (
    result.success &&
    isObject(result.payload) &&
    result.payload.success === true &&
    !supportsCalendarResponse(result.payload, calendar) &&
    !(
      isObject(result.payload.settings) &&
      result.payload.settings.view_records_in_web_portal === false
    )
  )
    return codedFailure("CALENDAR_UPGRADE_REQUIRED");
  return result.success ? summaryResponse(result.payload, calendar) : result;
}

function supportsCalendarResponse(payload: Record<string, unknown>, calendar:ClassCalendar) {
  return payload.calendar_version === 2 || (payload.calendar_version === undefined && calendar.legacySpreadsheet === true);
}

function classworkEnvelope(
  payload: unknown,
  action: "all_classworks" | "student",
  calendar: ClassCalendar,
):
  | {
      success: true;
      data: Record<string, unknown>;
      settings: SpreadsheetSettings;
    }
  | Failure {
  if (!isObject(payload)) return failure(classworkMalformedMessage);
  if (payload.success === false) return providerFailure(payload, action);
  if (
    payload.success !== true ||
    payload.action !== action ||
    !isObject(payload.data) ||
    !isObject(payload.settings) ||
    typeof payload.settings.view_records_in_web_portal !== "boolean" ||
    typeof payload.settings.view_excluded_columns_in_web_portal !== "boolean"
  ) {
    return failure(classworkMalformedMessage);
  }
  if (!payload.settings.view_records_in_web_portal)
    return codedFailure("RECORDS_DISABLED", action === "student");
  if (!supportsCalendarResponse(payload,calendar))
    return codedFailure("CALENDAR_UPGRADE_REQUIRED", action === "student");
  return {
    success: true,
    data: payload.data,
    settings: {
      viewRecords: payload.settings.view_records_in_web_portal,
      viewExcluded: payload.settings.view_excluded_columns_in_web_portal,
    },
  };
}

function classworkPeriods(
  value: unknown,
  settings: SpreadsheetSettings,
  includeScores: boolean,
  calendar: ClassCalendar,
): ClassworkPeriod[] | null {
  if (!Array.isArray(value)) return null;
  const periodNames = calendar.periods.map((period) => period.name);
  const seen = new Set<string>();
  const periods: ClassworkPeriod[] = [];
  for (const rawPeriod of value) {
    if (
      !isObject(rawPeriod) ||
      typeof rawPeriod.period !== "string" ||
      !periodNames.includes(rawPeriod.period as ClassworkPeriod["period"]) ||
      seen.has(rawPeriod.period) ||
      !Array.isArray(rawPeriod.categories)
    )
      return null;
    seen.add(rawPeriod.period);
    const categories: ClassworkCategory[] = [];
    for (const rawCategory of rawPeriod.categories) {
      if (
        !isObject(rawCategory) ||
        typeof rawCategory.name !== "string" ||
        !rawCategory.name.trim() ||
        !Array.isArray(rawCategory.activities) ||
        (rawCategory.weight !== null &&
          (typeof rawCategory.weight !== "number" ||
            !Number.isFinite(rawCategory.weight) ||
            rawCategory.weight < 0 ||
            rawCategory.weight > 100))
      )
        return null;
      const activities: ClassworkActivity[] = [];
      for (const rawActivity of rawCategory.activities) {
        if (
          !isObject(rawActivity) ||
          typeof rawActivity.name !== "string" ||
          !rawActivity.name.trim() ||
          (rawActivity.is_additional_points !== undefined &&
            typeof rawActivity.is_additional_points !== "boolean") ||
          typeof rawActivity.is_excludable !== "boolean"
        )
          return null;
        const name = rawActivity.name.replace(/`/g, "").trim();
        if (!name) return null;
        const isAdditionalPoints =
          rawActivity.is_additional_points === true ||
          isAdditionalPointsActivity(name);
        if (
          !(isAdditionalPoints && rawActivity.max_score === null) &&
          (typeof rawActivity.max_score !== "number" ||
            !Number.isFinite(rawActivity.max_score) ||
            rawActivity.max_score <= 0)
        )
          return null;
        const isExcludable =
          rawActivity.is_excludable || rawActivity.name.includes("`");
        if (isExcludable && !settings.viewExcluded) continue;
        const activity: ClassworkActivity = {
          name,
          maxScore: isAdditionalPoints
            ? null
            : (rawActivity.max_score as number),
          isExcludable,
          ...(isAdditionalPoints ? { isAdditionalPoints: true } : {}),
        };
        if (isAdditionalPoints && !includeScores) continue;
        if (includeScores) {
          if (isAdditionalPoints && rawActivity.score == null) continue;
          const score = displayValue(rawActivity.score);
          if (score === undefined) return null;
          if (isAdditionalPoints && (score === null || !score.trim())) continue;
          activity.score = score;
        }
        activities.push(activity);
      }
      categories.push({
        name: rawCategory.name.trim(),
        weight: rawCategory.weight as number | null,
        activities,
      });
    }
    if (
      includeScores &&
      rawPeriod.note != null &&
      typeof rawPeriod.note !== "string"
    )
      return null;
    periods.push({
      period: rawPeriod.period,
      key: calendar.periods.find((period) => period.name === rawPeriod.period)!
        .key,
      categories,
      ...(includeScores
        ? {
            note:
              typeof rawPeriod.note === "string"
                ? rawPeriod.note.trim() || null
                : null,
          }
        : {}),
    });
  }
  // The script returns all four periods, including an empty catalog for a missing sheet.
  if (seen.size !== periodNames.length) return null;
  return periodNames.map(
    (name) => periods.find((period) => period.period === name)!,
  );
}

export async function getClassworkCatalog(
  spreadsheetUrl: string,
  calendar: ClassCalendar,
): Promise<ClassworkCatalogResult> {
  const response = await requestSpreadsheet(
    spreadsheetUrl,
    "all_classworks",
    undefined,
    calendar,
  );
  if (!response.success) return response;
  const envelope = classworkEnvelope(
    response.payload,
    "all_classworks",
    calendar,
  );
  if (!envelope.success) return envelope;
  const periods = classworkPeriods(
    envelope.data.periods,
    envelope.settings,
    false,
    calendar,
  );
  return periods
    ? { success: true, periods }
    : failure(classworkMalformedMessage);
}

export async function getStudentClasswork(
  spreadsheetUrl: string,
  studentNumber: string,
  calendar: ClassCalendar,
): Promise<StudentClassworkResult> {
  const number = studentNumber.trim();
  if (!number)
    return failure(
      "A student number is required to load your spreadsheet records.",
    );
  const response = await requestSpreadsheet(
    spreadsheetUrl,
    "student",
    number,
    calendar,
  );
  if (!response.success) return response;
  const envelope = classworkEnvelope(response.payload, "student", calendar);
  if (!envelope.success) return envelope;
  // Student numbers are identifiers: preserve leading zeros and letter case; never match by name.
  if (
    typeof envelope.data.student_num !== "string" ||
    envelope.data.student_num.trim() !== number
  ) {
    return failure(classworkMalformedMessage);
  }
  const summary = summaryResponse(
    { success: true, data: { students: [envelope.data] } },
    calendar,
  );
  if (!summary.success) return failure(classworkMalformedMessage);
  const periods = classworkPeriods(
    envelope.data.periods,
    envelope.settings,
    true,
    calendar,
  );
  return periods
    ? { success: true, record: summary.students[0], periods }
    : failure(classworkMalformedMessage);
}
