const DEFAULT_SEMESTER = "1stSem";
const STUDENT_GRADES_FETCH_TIMEOUT_MS = 10_000;
const NESTED_GRADE_LABELS = new Set(["prelim", "midterm", "prefinals", "finals", "ave", "remarks", "note"]);

type GradeRecord = Record<string, unknown>;

export type StudentGrade = {
  subject: string;
  code: string | null;
  units: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
  prelim: string | null;
  midterm: string | null;
  prefinals: string | null;
  finals: string | null;
  average: string | null;
  remarks: string | null;
  note: string | null;
  raw: GradeRecord;
};

export type StudentGradesResult =
  | {
      success: true;
      semester: string;
      studentName: string | null;
      grades: StudentGrade[];
      raw: unknown;
    }
  | {
      success: false;
      semester: string;
      message: string;
    };

function isRecord(value: unknown): value is GradeRecord {
  return typeof value === "object" && value !== null;
}

function hasValue(value: unknown) {
  return value !== undefined && value !== null && value !== "";
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[\s_-]+/g, "");
}

function getValue(record: GradeRecord, keys: string[]) {
  const entries = Object.entries(record);
  for (const key of keys) {
    if (hasValue(record[key])) return record[key];
    const normalizedKey = normalizeKey(key);
    const match = entries.find(([entryKey, value]) => hasValue(value) && normalizeKey(entryKey) === normalizedKey);
    if (match) return match[1];
  }
  return null;
}

function stringifyNullable(value: unknown) {
  return value === null || value === undefined ? null : String(value).trim() || null;
}

function getNestedGrades(record: GradeRecord) {
  const values = new Map<string, string | null>();
  if (Array.isArray(record.grades)) {
    for (const item of record.grades) {
      if (!isRecord(item)) continue;
      const label = stringifyNullable(item.Label)?.toLowerCase();
      // The first matching label wins, including a blank value.
      if (label && NESTED_GRADE_LABELS.has(label) && !values.has(label)) {
        values.set(label, stringifyNullable(item.Value));
      }
    }
  }
  return values;
}

function normalizeGrade(record: GradeRecord): StudentGrade {
  const subject = getValue(record, [
    "subject_title", "subjectTitle", "subject", "subject_name", "subjectName", "description", "course",
  ]);
  const grades = getNestedGrades(record);

  return {
    subject: subject === null ? "Untitled subject" : String(subject),
    code: stringifyNullable(getValue(record, ["subject_code", "subjectCode", "code"])),
    units: stringifyNullable(getValue(record, ["unit", "units", "credit", "credits"])),
    instructor_id: stringifyNullable(getValue(record, ["instructor_id", "teacher_id", "faculty_id"])),
    instructor_name: stringifyNullable(getValue(record, ["instructor_name", "teacher_name", "faculty_name"])),
    prelim: grades.get("prelim") ?? null,
    midterm: grades.get("midterm") ?? null,
    prefinals: grades.get("prefinals") ?? null,
    finals: grades.get("finals") ?? null,
    average: grades.get("ave") ?? stringifyNullable(getValue(record, ["grade", "final_grade", "finalGrade", "average"])),
    remarks: grades.get("remarks") ?? stringifyNullable(getValue(record, ["remarks", "remark", "status"])),
    note: grades.get("note") ?? null,
    raw: record,
  };
}

function extractGradeRows(payload: unknown): GradeRecord[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload)
      ? ["Grades", "grades", "data", "records", "subjects", "result"].map((key) => payload[key]).find(Array.isArray)
      : undefined;
  return rows?.filter(isRecord) ?? [];
}

function isRealGradeRow(grade: StudentGrade) {
  return !(grade.code?.toLowerCase() === "code:" && grade.subject.toLowerCase() === "subject:");
}

function extractStudentName(payload: unknown) {
  return isRecord(payload) ? stringifyNullable(payload.student_name) : null;
}

export function normalizeSemester(value: string | string[] | undefined) {
  const semester = Array.isArray(value) ? value[0] : value;
  return semester === "2" || semester === "2ndSem" ? "2ndSem" : DEFAULT_SEMESTER;
}

export async function getStudentGrades(
  studentNumber: string,
  semester: string
): Promise<StudentGradesResult> {
  const failure = (message: string) => ({ success: false as const, semester, message });
  const endpoint = process.env.STUDENT_GRADES_APPS_SCRIPT_URL;
  if (!endpoint) return failure("Student grades Apps Script URL is not configured.");

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return failure("Student grades Apps Script URL is not configured or malformed.");
  }

  url.searchParams.set("student_no", studentNumber);
  url.searchParams.set("semester", semester);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STUDENT_GRADES_FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return failure(`Grades service returned ${response.status}.`);

    const payload: unknown = await response.json();
    return {
      success: true,
      semester,
      studentName: extractStudentName(payload),
      grades: extractGradeRows(payload).map(normalizeGrade).filter(isRealGradeRow),
      raw: payload,
    };
  } catch {
    return failure("Unable to load grades right now.");
  }
}
