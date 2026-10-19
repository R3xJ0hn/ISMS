export type SheetRosterStudent = {
  rowNumber: number;
  studentNumber: string;
  studentName: string;
};

export type DatabaseRosterStudent = {
  id: string;
  studentNumber: string | null;
  name: string;
  /** Structured names let the comparison ignore middle names without dropping given-name words. */
  firstName?: string;
  lastName?: string;
};

export type CrossMatchIssue =
  | "missing_number"
  | "missing_name"
  | "duplicate_number"
  | "duplicate_name"
  | "ambiguous_database"
  | "not_found"
  | "name_mismatch"
  | "not_enrolled";

export type ClassRosterComparison = {
  rows: {
    rowNumber: number;
    studentNumber: string;
    sheetName: string;
    databaseId: string | null;
    databaseName: string | null;
    enrolled: boolean;
    issues: CrossMatchIssue[];
  }[];
  missingStudents: DatabaseRosterStudent[];
  /** Sheet rows with no issues: an exact, unique, enrolled identity and matching name. */
  matchedCount: number;
  /** Affected sheet rows counted once, plus enrolled students missing from the sheet. */
  issueCount: number;
};

/** The INPUT roster concatenates these three fields as Last name, First name Middle name. */
export function formatClassRosterName(student: { firstName: string; middleName?: string | null; lastName: string }) {
  const cleanPart = (value: string | null | undefined) => value?.trim().replace(/\s+/gu, " ") ?? "";
  const lastName = cleanPart(student.lastName);
  const givenNames = [cleanPart(student.firstName), cleanPart(student.middleName)].filter(Boolean).join(" ");
  return [lastName, givenNames].filter(Boolean).join(", ");
}

function normalizedName(name: string) {
  return name.normalize("NFC").trim().replace(/\s+/gu, " ").replace(/\s*,\s*/gu, ", ").toLowerCase();
}

function matchesStudentName(sheetName: string, student: DatabaseRosterStudent) {
  if (student.firstName === undefined && student.lastName === undefined) {
    return normalizedName(sheetName) === normalizedName(student.name);
  }
  if (student.firstName === undefined || student.lastName === undefined) return false;
  const firstName = normalizedName(student.firstName);
  const lastName = normalizedName(student.lastName);
  if (!firstName || !lastName) return false;
  const name = normalizedName(sheetName);
  const separator = name.indexOf(",");
  if (separator === -1 || name.slice(0, separator).trim() !== lastName) return false;
  const givenNames = name.slice(separator + 1).trim();
  // The saved first name can contain several words. Only text after the whole
  // first name is treated as an optional middle name; partial first names fail.
  return givenNames === firstName || (givenNames.startsWith(firstName) && /^[\s,]/u.test(givenNames.slice(firstName.length)));
}

function compareText(first: string, second: string) {
  return first < second ? -1 : first > second ? 1 : 0;
}

/**
 * Compare a sheet snapshot with saved students; never infer identity from a name.
 * Keep sheet order, copy missing records, and leave all supplied arrays untouched.
 */
export function compareClassRoster(
  sheetStudents: readonly SheetRosterStudent[],
  databaseStudents: readonly DatabaseRosterStudent[],
  enrolledStudentIds: readonly string[],
): ClassRosterComparison {
  const studentsById = new Map<string, DatabaseRosterStudent>();
  const studentsByNumber = new Map<string, DatabaseRosterStudent[]>();
  for (const student of databaseStudents) {
    // Joins can repeat a student. Only distinct saved identities cause ambiguity.
    if (studentsById.has(student.id)) continue;
    studentsById.set(student.id, student);
    const number = student.studentNumber?.trim();
    if (number) {
      const matches = studentsByNumber.get(number) ?? [];
      matches.push(student);
      studentsByNumber.set(number, matches);
    }
  }

  const enrolledIds = new Set(enrolledStudentIds);
  const numberCounts = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  const preparedRows = sheetStudents.map((student) => {
    const number = student.studentNumber.trim();
    const name = student.studentName.trim();
    const nameKey = normalizedName(name);
    if (number) numberCounts.set(number, (numberCounts.get(number) ?? 0) + 1);
    if (nameKey) nameCounts.set(nameKey, (nameCounts.get(nameKey) ?? 0) + 1);
    return { rowNumber: student.rowNumber, number, name, nameKey };
  });

  const rows = preparedRows.map(({ rowNumber, number, name, nameKey }) => {
    const issues: CrossMatchIssue[] = [];
    if (!number) issues.push("missing_number");
    if (!nameKey) issues.push("missing_name");
    if (number && (numberCounts.get(number) ?? 0) > 1) issues.push("duplicate_number");
    if (nameKey && (nameCounts.get(nameKey) ?? 0) > 1) issues.push("duplicate_name");

    const matches = number ? studentsByNumber.get(number) ?? [] : [];
    const student = matches.length === 1 ? matches[0] : null;
    if (matches.length > 1) issues.push("ambiguous_database");
    else if (number && matches.length === 0) issues.push("not_found");
    const enrolled = student !== null && enrolledIds.has(student.id);
    if (student) {
      if (nameKey && !matchesStudentName(name, student)) issues.push("name_mismatch");
      if (!enrolled) issues.push("not_enrolled");
    }

    return {
      rowNumber,
      studentNumber: number,
      sheetName: name,
      databaseId: student?.id ?? null,
      databaseName: student?.name ?? null,
      enrolled,
      issues,
    };
  });

  const missingStudents = [...studentsById.values()]
    .filter((student) => enrolledIds.has(student.id) &&
      (!student.studentNumber?.trim() || !numberCounts.has(student.studentNumber.trim())))
    .sort((first, second) => compareText(normalizedName(first.name), normalizedName(second.name)) ||
      compareText(first.id, second.id))
    .map(({ id, studentNumber, name }) => ({ id, studentNumber, name }));

  const matchedCount = rows.filter((row) => row.issues.length === 0).length;
  return {
    rows,
    missingStudents,
    matchedCount,
    // Count affected records once even when one sheet row has several problems.
    issueCount: rows.length - matchedCount + missingStudents.length,
  };
}
