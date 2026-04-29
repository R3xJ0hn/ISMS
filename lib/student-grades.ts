const DEFAULT_SEMESTER = "1stSem";
const STUDENT_GRADES_FETCH_TIMEOUT_MS = 10_000;

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

function getValue(record: GradeRecord, keys: string[]) {
  const entries = Object.entries(record);

  for (const key of keys) {
    const directValue = record[key];

    if (directValue !== undefined && directValue !== null && directValue !== "") {
      return directValue;
    }

    const normalizedKey = key.toLowerCase().replace(/[\s_-]+/g, "");
    const matchedEntry = entries.find(
      ([entryKey, value]) =>
        entryKey.toLowerCase().replace(/[\s_-]+/g, "") === normalizedKey &&
        value !== undefined &&
        value !== null &&
        value !== ""
    );

    if (matchedEntry) {
      return matchedEntry[1];
    }
  }

  return null;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  return String(value);
}

function stringifyNullable(value: unknown) {
  const stringified = stringifyValue(value)?.toString().trim() ?? null;

  return stringified || null;
}

function getNestedGradeValue(record: GradeRecord, label: string) {
  const gradeItems = record.grades;

  if (!Array.isArray(gradeItems)) {
    return null;
  }

  const normalizedLabel = label.toLowerCase();
  const match = gradeItems.find((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const itemRecord = item as GradeRecord;

    return stringifyNullable(itemRecord.Label)?.toLowerCase() === normalizedLabel;
  });

  if (!match || typeof match !== "object") {
    return null;
  }

  return stringifyNullable((match as GradeRecord).Value);
}

function normalizeGrade(record: GradeRecord): StudentGrade {
  const subject =
    stringifyValue(
      getValue(record, [
        "subject_title",
        "subjectTitle",
        "subject",
        "subject_name",
        "subjectName",
        "description",
        "course",
      ])
    ) ?? "Untitled subject";

  return {
    subject: String(subject),
    code: stringifyNullable(getValue(record, ["subject_code", "subjectCode", "code"])),
    units: stringifyNullable(getValue(record, ["unit", "units", "credit", "credits"])),
    instructor_id: stringifyNullable(getValue(record, ["instructor_id", "teacher_id", "faculty_id"])),
    instructor_name: stringifyNullable(getValue(record, ["instructor_name", "teacher_name", "faculty_name"])),
    prelim: getNestedGradeValue(record, "Prelim"),
    midterm: getNestedGradeValue(record, "Midterm"),
    prefinals: getNestedGradeValue(record, "Prefinals"),
    finals: getNestedGradeValue(record, "Finals"),
    average:
      getNestedGradeValue(record, "Ave") ??
      stringifyNullable(getValue(record, ["grade", "final_grade", "finalGrade", "average"])),
    remarks:
      getNestedGradeValue(record, "Remarks") ??
      stringifyNullable(getValue(record, ["remarks", "remark", "status"])),
    note: getNestedGradeValue(record, "Note"),
    raw: record,
  };
}

function extractGradeRows(payload: unknown): GradeRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item): item is GradeRecord => typeof item === "object" && item !== null
    );
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as GradeRecord;
  const candidates = [
    record.Grades,
    record.grades,
    record.data,
    record.records,
    record.subjects,
    record.result,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(
        (item): item is GradeRecord => typeof item === "object" && item !== null
      );
    }
  }

  return [];
}

function isRealGradeRow(grade: StudentGrade) {
  return !(
    grade.code?.toLowerCase() === "code:" &&
    grade.subject.toLowerCase() === "subject:"
  );
}

function extractStudentName(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return stringifyNullable((payload as GradeRecord).student_name);
}

export function normalizeSemester(value: string | string[] | undefined) {
  const semester = Array.isArray(value) ? value[0] : value;

  if (semester === "2" || semester === "2ndSem") {
    return "2ndSem";
  }

  return DEFAULT_SEMESTER;
}

export async function getStudentGrades(
  studentNumber: string,
  semester: string
): Promise<StudentGradesResult> {
  const endpoint = process.env.STUDENT_GRADES_APPS_SCRIPT_URL;

  if (!endpoint) {
    return {
      success: false,
      semester,
      message: "Student grades Apps Script URL is not configured.",
    };
  }

  let url: URL;

  try {
    url = new URL(endpoint);
  } catch {
    return {
      success: false,
      semester,
      message: "Student grades Apps Script URL is not configured or malformed.",
    };
  }

  url.searchParams.set("student_no", studentNumber);
  url.searchParams.set("semester", semester);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      STUDENT_GRADES_FETCH_TIMEOUT_MS
    );
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return {
        success: false,
        semester,
        message: `Grades service returned ${response.status}.`,
      };
    }

    const payload: unknown = await response.json();
    const rows = extractGradeRows(payload);
    const grades = rows.map(normalizeGrade).filter(isRealGradeRow);

    return {
      success: true,
      semester,
      studentName: extractStudentName(payload),
      grades,
      raw: payload,
    };
  } catch {
    return {
      success: false,
      semester,
      message: "Unable to load grades right now.",
    };
  }
}
