import type { CellObject, WorkSheet } from "xlsx";

export const classRosterImportMaxBytes = 5 * 1024 * 1024;
export const classRosterImportMaxRows = 1000;
const maxColumns = 50;

export type ClassRosterStudent = {
  id: string;
  name: string;
  studentNumber: string | null;
};

export type ClassRosterImportRow = {
  rowNumber: number;
  studentNumber: string;
  name: string;
  studentId: string | null;
  message: string;
};

export type ClassRosterImportResult =
  | { success: true; rows: ClassRosterImportRow[] }
  | { success: false; message: string };

function normalizeName(name: string) {
  return name.trim().replace(/\s+/gu, " ").normalize("NFC").toLowerCase();
}

function hasFormula(cell: CellObject | undefined) {
  return cell?.f !== undefined || cell?.F !== undefined;
}

function readText(cell: CellObject | undefined) {
  return !hasFormula(cell) && cell?.t === "s" && typeof cell.v === "string" ? cell.v.trim() : "";
}

function readStudentNumber(cell: CellObject | undefined): { value: string; valid: boolean } {
  if (hasFormula(cell)) return { value: "", valid: false };
  if (cell?.t === "s" && typeof cell.v === "string") {
    return { value: cell.v.trim(), valid: true };
  }
  // Excel can discard leading zeroes and rounds numeric identifiers beyond 15 digits.
  // Only a plain all-zero number format can explicitly preserve leading zeroes.
  if (cell?.t === "n" && typeof cell.v === "number") {
    const value = String(cell.v);
    const plainFormat = cell.z === undefined || cell.z === "General";
    const zeroPadding = typeof cell.z === "string" && /^0{1,255}$/u.test(cell.z) ? cell.z.length : 0;
    if ((plainFormat || zeroPadding) && Number.isSafeInteger(cell.v) && cell.v >= 0 && /^\d{1,15}$/u.test(value)) {
      return { value: value.padStart(zeroPadding, "0"), valid: true };
    }
    return { value, valid: false };
  }
  return { value: "", valid: cell === undefined || cell.t === "z" };
}

function isEmptyCell(cell: CellObject | undefined) {
  if (hasFormula(cell)) return false;
  return cell?.v === undefined || cell.v === null || (typeof cell.v === "string" && cell.v.trim() === "");
}

function isExpectedWorkbook(bytes: Uint8Array, extension: string) {
  const signature = extension === "xlsx" ? [0x50, 0x4b, 0x03, 0x04] : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  return signature.every((value, index) => bytes[index] === value);
}

function headerKind(cell: CellObject | undefined) {
  const name = readText(cell).toLowerCase().replace(/[\s._-]+/gu, "");
  if (["studentnumber", "studentno"].includes(name)) return "studentNumber";
  if (["name", "fullname", "studentname"].includes(name)) return "name";
  return null;
}

/** Read a reference list only. A matching row selects an existing student; it never creates a record. */
export async function parseClassRosterWorkbook(
  file: File,
  students: readonly ClassRosterStudent[],
): Promise<ClassRosterImportResult> {
  if (file.size === 0) return { success: false, message: "Choose an Excel workbook that contains your student list." };
  if (file.size > classRosterImportMaxBytes) return { success: false, message: "Choose an Excel workbook no larger than 5 MB." };
  const extension = /\.([^.]+)$/u.exec(file.name)?.[1].toLowerCase();
  if (extension !== "xlsx" && extension !== "xls") {
    return { success: false, message: "Choose an Excel workbook (.xlsx or .xls)." };
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > classRosterImportMaxBytes) {
      return { success: false, message: "Choose an Excel workbook no larger than 5 MB." };
    }
    if (!isExpectedWorkbook(bytes, extension)) {
      return { success: false, message: "This file is not a valid Excel workbook. Save it as .xlsx or .xls and try again." };
    }

    const xlsx = await import("xlsx");
    const workbook = xlsx.read(bytes, {
      type: "array", sheets: 0, sheetRows: classRosterImportMaxRows + 2,
      cellFormula: true, cellNF: true, cellText: false,
    });
    const sheet: WorkSheet | undefined = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet?.["!ref"]) return { success: false, message: "The first worksheet is empty. Add Student Number and Name headers in row 1." };

    // !fullref retains the original range when sheetRows truncates parsing. Check
    // bounds before creating a grid, including worksheets with distant cells.
    const reference = sheet["!fullref"] ?? sheet["!ref"];
    if (!/^[A-Z]+[1-9]\d*(?::[A-Z]+[1-9]\d*)?$/u.test(reference)) {
      return { success: false, message: "The first worksheet has an invalid cell range." };
    }
    const range = xlsx.utils.decode_range(reference);
    if (range.s.r !== 0 || range.s.c < 0 || range.e.c >= maxColumns || range.e.c < range.s.c || range.e.r < range.s.r) {
      return { success: false, message: "Put the headers in row 1 and keep the first worksheet within 50 columns." };
    }
    if (!Number.isSafeInteger(range.e.r) || range.e.r > classRosterImportMaxRows) {
      return { success: false, message: "The first worksheet can contain up to 1,000 student rows. Remove extra rows and try again." };
    }

    let numberColumn: number | undefined;
    let nameColumn: number | undefined;
    for (let column = 0; column <= range.e.c; column += 1) {
      const kind = headerKind(sheet[xlsx.utils.encode_cell({ r: 0, c: column })]);
      if (kind === "studentNumber") {
        if (numberColumn !== undefined) return { success: false, message: "Keep only one Student Number column in the first worksheet." };
        numberColumn = column;
      } else if (kind === "name") {
        if (nameColumn !== undefined) return { success: false, message: "Keep only one Name column in the first worksheet." };
        nameColumn = column;
      }
    }
    if (numberColumn === undefined || nameColumn === undefined) {
      return { success: false, message: "The first row must contain Student Number and Name headers." };
    }

    const savedByNumber = new Map<string, ClassRosterStudent[]>();
    for (const student of students) {
      const number = student.studentNumber?.trim();
      if (!number) continue;
      const saved = savedByNumber.get(number) ?? [];
      saved.push(student);
      savedByNumber.set(number, saved);
    }

    const parsed: { row: ClassRosterImportRow; validNumber: boolean; nameCell: CellObject | undefined }[] = [];
    const occurrences = new Map<string, number>();
    for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
      let empty = true;
      for (let column = 0; column <= range.e.c; column += 1) {
        if (!isEmptyCell(sheet[xlsx.utils.encode_cell({ r: rowIndex, c: column })])) { empty = false; break; }
      }
      if (empty) continue;
      const number = readStudentNumber(sheet[xlsx.utils.encode_cell({ r: rowIndex, c: numberColumn })]);
      const nameCell: CellObject | undefined = sheet[xlsx.utils.encode_cell({ r: rowIndex, c: nameColumn })];
      parsed.push({
        row: { rowNumber: rowIndex + 1, studentNumber: number.value, name: readText(nameCell), studentId: null, message: "" },
        validNumber: number.valid, nameCell,
      });
      if (number.valid && number.value) occurrences.set(number.value, (occurrences.get(number.value) ?? 0) + 1);
    }
    if (parsed.length === 0) return { success: false, message: "Add at least one student below the Student Number and Name headers." };

    const rows = parsed.map(({ row, validNumber, nameCell }) => {
      if (!validNumber) {
        row.message = "Use a student number stored as Text, without a formula or scientific notation.";
      } else if (hasFormula(nameCell)) {
        row.message = "Enter the student's name as text instead of a formula.";
      } else if (!row.studentNumber || !row.name) {
        row.message = "Student Number and Name are both required.";
      } else if ((occurrences.get(row.studentNumber) ?? 0) > 1) {
        row.message = "This student number appears more than once in the file. Keep one row and upload again.";
      } else {
        const matches = savedByNumber.get(row.studentNumber) ?? [];
        if (matches.length === 0) row.message = "No saved student matches this student number.";
        else if (matches.length > 1) row.message = "More than one saved student has this number. Correct the saved records first.";
        else if (normalizeName(matches[0].name) !== normalizeName(row.name)) {
          row.message = "The name does not match the saved student record. Use the student's complete saved name.";
        } else {
          row.studentId = matches[0].id;
          row.message = "Ready to add.";
        }
      }
      return row;
    });
    return { success: true, rows };
  } catch {
    return { success: false, message: "Unable to read this Excel workbook. Save it as .xlsx or .xls and try again." };
  }
}
