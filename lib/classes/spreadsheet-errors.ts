const spreadsheetMessages = {
  SPREADSHEET_ACCESS_DENIED: "Spreadsheet access is restricted. Share the spreadsheet with the Google account running the Apps Script deployment, then refresh.",
  SPREADSHEET_OPEN_FAILED: "The connected spreadsheet could not be opened. Check that the saved Google Sheets link is correct and the spreadsheet still exists, then refresh.",
  SCRIPT_ACCESS_DENIED: "The portal cannot access the Apps Script spreadsheet service without Google sign-in. Ask an administrator to check the deployment URL and web app access settings so the portal can call it without signing in.",
  CONNECTION_UNAUTHORIZED: "The spreadsheet service rejected the portal connection. Ask an administrator to check the connection's shared secret in the portal and Apps Script.",
  RECORDS_DISABLED: "Spreadsheet records are disabled. Enable the View Records in Web Portal checkbox at INPUT!G7, then refresh.",
  DUPLICATE_STUDENT_NUMBER_INPUT: "The INPUT sheet has duplicate student numbers. Give each student a unique student number in INPUT, then refresh.",
  DUPLICATE_STUDENT_NAME_INPUT: "The INPUT sheet has duplicate student names. Correct the duplicate names so grades can be matched safely, then refresh.",
  DUPLICATE_STUDENT_NAME_REPORT: "The REPORT sheet has duplicate student names. Correct the duplicate names so grades can be matched safely, then refresh.",
  INCOMPLETE_STUDENT_INPUT: "The INPUT sheet has a student record without a name or student number. Complete both fields for every student, then refresh.",
  STUDENT_MISSING_REPORT: "A student in INPUT is missing from REPORT. Check that every INPUT student has a matching REPORT record, then refresh.",
  STUDENT_NUMBER_REQUIRED: "A student number is required to load your spreadsheet records. Contact the registrar if your number is unavailable.",
  STUDENT_NUMBER_NOT_FOUND: "Your student number is not listed in this class spreadsheet. Ask your teacher to add or correct it.",
  STUDENT_REPORT_NOT_FOUND: "Your grade record is not available in this class spreadsheet yet. Ask your teacher to check the REPORT sheet.",
  STUDENT_RECORD_AMBIGUOUS: "Your spreadsheet records cannot be matched safely. Ask your teacher to correct duplicate student records in INPUT and REPORT.",
} as const;

export type SpreadsheetErrorCode = keyof typeof spreadsheetMessages;

const studentMessages: Record<SpreadsheetErrorCode, string> = {
  SPREADSHEET_ACCESS_DENIED: "Your class spreadsheet cannot be accessed. Ask your teacher to share it with the Google account running the Apps Script deployment, then try again.",
  SPREADSHEET_OPEN_FAILED: "Your class spreadsheet could not be opened. Ask your teacher to check the saved Google Sheets link and that the spreadsheet still exists.",
  SCRIPT_ACCESS_DENIED: "The portal cannot access the spreadsheet service. Ask your teacher or administrator to check the Apps Script deployment and its access settings.",
  CONNECTION_UNAUTHORIZED: "Your spreadsheet connection could not be authenticated. Ask your teacher or administrator to check the connection's shared secret in the portal and Apps Script.",
  RECORDS_DISABLED: "Your teacher has disabled spreadsheet records for this class. Ask your teacher to enable View Records in Web Portal at INPUT!G7 to show your records.",
  DUPLICATE_STUDENT_NUMBER_INPUT: "The class spreadsheet has duplicate student numbers in INPUT. Ask your teacher to correct them, then try again.",
  DUPLICATE_STUDENT_NAME_INPUT: "The class spreadsheet has duplicate student names in INPUT. Ask your teacher to correct them so your records can be matched safely.",
  DUPLICATE_STUDENT_NAME_REPORT: "The class spreadsheet has duplicate student names in REPORT. Ask your teacher to correct them so your records can be matched safely.",
  INCOMPLETE_STUDENT_INPUT: "The class spreadsheet has an incomplete student entry in INPUT. Ask your teacher to complete each student's name and student number.",
  STUDENT_MISSING_REPORT: "The class spreadsheet has an INPUT student missing from REPORT. Ask your teacher to check the REPORT sheet, then try again.",
  STUDENT_NUMBER_REQUIRED: spreadsheetMessages.STUDENT_NUMBER_REQUIRED,
  STUDENT_NUMBER_NOT_FOUND: spreadsheetMessages.STUDENT_NUMBER_NOT_FOUND,
  STUDENT_REPORT_NOT_FOUND: spreadsheetMessages.STUDENT_REPORT_NOT_FOUND,
  STUDENT_RECORD_AMBIGUOUS: spreadsheetMessages.STUDENT_RECORD_AMBIGUOUS,
};

export function isSpreadsheetErrorCode(code: unknown): code is SpreadsheetErrorCode {
  return typeof code === "string" && Object.hasOwn(spreadsheetMessages, code);
}

export function getSpreadsheetErrorMessage(code: unknown): string | null {
  return isSpreadsheetErrorCode(code) ? spreadsheetMessages[code] : null;
}

/** Student pages accept only fixed, allowlisted messages; provider text never passes through. */
export function getStudentSpreadsheetErrorMessage(code: unknown): string | null {
  return isSpreadsheetErrorCode(code) ? studentMessages[code] : null;
}

const legacyCodes: Record<string, SpreadsheetErrorCode> = {
  "Unauthorized": "CONNECTION_UNAUTHORIZED",
  "This class has not enabled spreadsheet records in the portal.": "RECORDS_DISABLED",
  "Incomplete student records in INPUT": "INCOMPLETE_STUDENT_INPUT",
  "Duplicate student number in INPUT": "DUPLICATE_STUDENT_NUMBER_INPUT",
  "Duplicate student name in INPUT": "DUPLICATE_STUDENT_NAME_INPUT",
  "Duplicate student name in REPORT": "DUPLICATE_STUDENT_NAME_REPORT",
  "Student missing from REPORT": "STUDENT_MISSING_REPORT",
};

/** Older deployments included private names after these fixed diagnostic prefixes. */
export function getSpreadsheetProviderErrorCode(code: unknown, error: unknown): SpreadsheetErrorCode | null {
  if (isSpreadsheetErrorCode(code)) return code;
  if (typeof error !== "string") return null;
  if (Object.hasOwn(legacyCodes, error)) return legacyCodes[error];
  if (error.startsWith("Duplicate student number:")) return "DUPLICATE_STUDENT_NUMBER_INPUT";
  if (error.startsWith("Duplicate name in INPUT:")) return "DUPLICATE_STUDENT_NAME_INPUT";
  if (error.startsWith("Duplicate student in REPORT:")) return "DUPLICATE_STUDENT_NAME_REPORT";
  return null;
}
