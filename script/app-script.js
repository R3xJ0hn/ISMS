
/**
 * STUDENT GRADES GOOGLE SHEETS API
 *
 * Supported actions:
 * 1. student
 * 2. all_students
 * 3. all_classworks
 *
 * Required sheets:
 * INPUT, REPORT, Prelim, Midterm, Pre-Finals, Finals
 *
 * INPUT!G7 = View Records in Web Portal
 * INPUT!G8 = View Excluded Columns in Web Portal
 *
 * Activity names containing ` are excludable.
 */

const CONFIG = {
  periods: [
    { name: "Prelim", sheet: "Prelim" },
    { name: "Midterm", sheet: "Midterm" },
    { name: "Prefinals", sheet: "Pre-Finals" },
    { name: "Finals", sheet: "Finals" }
  ],

  input: {
    studentStartRow: 11,
    subjectCode: "C8",
    subjectTitle: "C3",
    instructorName: "C4",
    viewRecords: "G7",
    viewExcluded: "G8"
  },

  report: {
    startRow: 6
  },

  gradeLabels: [
    "Prelim",
    "Midterm",
    "Prefinals",
    "Finals",
    "Ave",
    "Remarks"
  ]
};

// =====================================
// UTILITIES
// =====================================

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalize(value) {
  return clean(value)
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function studentRequestError(code, message = "Student request could not be completed") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return value;
  }

  const text = clean(value);
  if (!text) return null;

  const num = Number(text.replace(/,/g, ""));

  return Number.isFinite(num) ? num : text;
}

function toBoolean(value) {
  const text = clean(value).toLowerCase();

  return value === true ||
    text === "true" ||
    text === "1";
}

function readRows(sheet, row, col, height, width) {
  return sheet
    .getRange(row, col, height, width)
    .getDisplayValues();
}

// =====================================
// SPREADSHEET SETTINGS
// =====================================

function getSettings(input) {
  return {
    view_records_in_web_portal:
      toBoolean(input.getRange(
        CONFIG.input.viewRecords
      ).getValue()),

    view_excluded_columns_in_web_portal:
      toBoolean(input.getRange(
        CONFIG.input.viewExcluded
      ).getValue())
  };
}

// =====================================
// SUBJECT INFORMATION
// =====================================

function getSubject(input) {
  return {
    subject_code: clean(
      input.getRange(
        CONFIG.input.subjectCode
      ).getDisplayValue()
    ),

    subject_title: clean(
      input.getRange(
        CONFIG.input.subjectTitle
      ).getDisplayValue()
    ),

    instructor_name: clean(
      input.getRange(
        CONFIG.input.instructorName
      ).getDisplayValue()
    )
  };
}

// =====================================
// STUDENT DIRECTORY
// INPUT:
// B = Student Name
// F = Student Number
// H = Note
// =====================================

function getStudents(input) {
  const start = CONFIG.input.studentStartRow;
  const lastRow = input.getLastRow();

  if (lastRow < start) return [];

  const rows = readRows(
    input,
    start,
    1,
    lastRow - start + 1,
    8
  );

  return rows
    .filter(row => clean(row[1]))
    .map(row => ({
      student_num: clean(row[5]),
      student_name: clean(row[1]),
      note: clean(row[7]) || null
    }));
}

function buildStudentIndex(students) {
  const byName = new Map();
  const byNumber = new Map();

  students.forEach(student => {
    const nameKey = normalize(student.student_name);
    const numberKey = student.student_num;

    if (byName.has(nameKey)) {
      throw studentRequestError(
        "STUDENT_RECORD_AMBIGUOUS",
        "Duplicate student name: " +
        student.student_name
      );
    }

    byName.set(nameKey, student);

    if (numberKey) {
      if (byNumber.has(numberKey)) {
        throw studentRequestError(
          "STUDENT_RECORD_AMBIGUOUS",
          "Duplicate student number: " + numberKey
        );
      }

      byNumber.set(numberKey, student);
    }
  });

  return { byName, byNumber };
}

// =====================================
// REPORT GRADES
//
// REPORT:
// B = Student Name
// C = Prelim
// D = Midterm
// E = Prefinals
// F = Finals
// G = Average
// H = Equivalent / Remarks
// =====================================

function formatGrades(values, note) {
  const grades = CONFIG.gradeLabels.map(
    (label, index) => ({
      Label: label,
      Value: toValue(values[index])
    })
  );

  grades.push({
    Label: "Note",
    Value: note || null
  });

  return grades;
}

function getAllReportStudents(book, students) {
  const report = book.getSheetByName("REPORT");

  if (!report) {
    throw new Error("REPORT sheet not found");
  }

  const start = CONFIG.report.startRow;
  const lastRow = report.getLastRow();

  if (lastRow < start) return [];

  const index = buildStudentIndex(students);

  const rows = readRows(
    report,
    start,
    2,
    lastRow - start + 1,
    7
  );

  const results = [];
  const seen = new Set();

  rows.forEach(row => {
    const name = clean(row[0]);

    if (!name) return;

    const key = normalize(name);
    const student = index.byName.get(key);

    // Only actual students from INPUT.
    if (!student) return;

    if (seen.has(key)) {
      throw studentRequestError(
        "STUDENT_RECORD_AMBIGUOUS",
        "Duplicate student in REPORT: " + name
      );
    }

    seen.add(key);

    results.push({
      student_num: student.student_num,
      student_name: student.student_name,
      grades: formatGrades(
        row.slice(1, 7),
        student.note
      )
    });
  });

  return results;
}

// =====================================
// CATEGORY WEIGHTS
// =====================================

function getCategoryWeight(name, input) {
  const normalized = normalize(name);

  let cell = null;

  if (normalized.includes("WRITTEN")) {
    cell = "F4";
  } else if (normalized.includes("PERFORMANCE")) {
    cell = "F5";
  } else if (
    normalized.includes("QUARTERLY") ||
    normalized.includes("EXAM")
  ) {
    cell = "F6";
  }

  if (!cell) return null;

  const raw = input.getRange(cell).getValue();
  const value = Number(raw);

  if (!Number.isFinite(value) || raw === "") {
    return null;
  }

  return value * 100;
}

// =====================================
// DYNAMIC ACTIVITY COLUMN DETECTION
// =====================================

function getActivityGroups(headers) {
  const categoryHeaders = headers[0];
  const groups = [];

  for (let col = 3; col < categoryHeaders.length; col++) {
    const title = clean(categoryHeaders[col]);

    if (!title) continue;

    const normalized = normalize(title);

    const isCategory =
      normalized.includes("WRITTEN") ||
      normalized.includes("PERFORMANCE") ||
      normalized.includes("QUARTERLY");

    if (isCategory) {
      groups.push({
        start: col,
        title
      });
    }
  }

  return groups;
}

function parseActivity(
  group,
  col,
  headers,
  settings
) {
  const rawName = clean(headers[1][col]);
  const rawMax = clean(headers[2][col]);

  // Backtick anywhere in name = excludable.
  const isExcludable = rawName.includes("`");

  if (
    isExcludable &&
    !settings.view_excluded_columns_in_web_portal
  ) {
    return null;
  }

  let name = rawName.replace(/`/g, "").trim();
  let maxScore = toValue(rawMax);

  const nameValue = toValue(name);

  // Exclude summary/calculated columns.
  if (
    /^(total|subtotal|average|ave|ps|percentage|initial grade|weighted score)$/i
      .test(name)
  ) {
    return null;
  }

  // Standard assessment: name in row 2,
  // maximum score in row 3.
  const isStandardActivity =
    name !== "" &&
    typeof nameValue !== "number" &&
    typeof maxScore === "number";

  // Special quarterly exam in your workbook:
  // numeric maximum score is in row 2.
  const isQuarterlyExam =
    normalize(group.title).includes("QUARTERLY") &&
    col === group.start &&
    typeof nameValue === "number";

  if (isQuarterlyExam) {
    name = "Quarterly Exam";
    maxScore = nameValue;
  } else if (!isStandardActivity) {
    return null;
  }

  if (maxScore <= 0) return null;

  return {
    name,
    max_score: maxScore,
    is_excludable: isExcludable,
    column_index: col
  };
}

// =====================================
// READ CLASSWORK CATALOG
// Optionally include a student's scores.
// =====================================

function readPeriod(
  book,
  period,
  input,
  settings,
  studentName = null
) {
  const sheet = book.getSheetByName(period.sheet);

  if (!sheet) {
    return {
      period: period.name,
      categories: []
    };
  }

  const lastCol = sheet.getLastColumn();

  if (sheet.getLastRow() < 3 || lastCol < 4) {
    return {
      period: period.name,
      categories: []
    };
  }

  const headers = readRows(
    sheet, 1, 1, 3, lastCol
  );

  let studentScores = null;

  if (studentName !== null) {
    const lastRow = sheet.getLastRow();
    const names = lastRow >= 4
      ? readRows(sheet, 4, 2, lastRow - 3, 1)
      : [];

    const matches = [];

    names.forEach((row, index) => {
      if (
        normalize(row[0]) ===
        normalize(studentName)
      ) {
        matches.push(index + 4);
      }
    });

    if (matches.length > 1) {
      throw studentRequestError("STUDENT_RECORD_AMBIGUOUS");
    }

    // A future period may have activities before its student rows are added.
    // Return its catalog with empty scores without reading anyone else's row.
    if (matches.length === 1) {
      studentScores = readRows(
        sheet,
        matches[0],
        1,
        1,
        lastCol
      )[0];
    }
  }

  const groups = getActivityGroups(headers);

  const categories = groups.map((group, index) => {
    let end = index + 1 < groups.length
      ? groups[index + 1].start
      : lastCol;

    // Stop before notes and other non-grade groups.
    for (let col = group.start + 1; col < end; col++) {
      const heading = normalize(headers[0][col]);

      if (
        heading === "NOTE" ||
        heading === "NOTES"
      ) {
        end = col;
        break;
      }
    }

    const activities = [];

    for (let col = group.start; col < end; col++) {
      const activity = parseActivity(
        group,
        col,
        headers,
        settings
      );

      if (!activity) continue;

      const output = {
        name: activity.name,
        max_score: activity.max_score,
        is_excludable: activity.is_excludable
      };

      if (studentName !== null) {
        output.score = studentScores === null
          ? null
          : toValue(studentScores[activity.column_index]);
      }

      activities.push(output);
    }

    const categoryName = group.title
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/`/g, "")
      .trim();

    return {
      name: categoryName,
      weight: getCategoryWeight(
        categoryName,
        input
      ),
      activities
    };
  });

  return {
    period: period.name,
    categories
  };
}

// =====================================
// ACTION 1: ALL CLASSWORKS
// =====================================

function getAllClassworks(book, input, settings) {
  const periods = CONFIG.periods.map(period =>
    readPeriod(book, period, input, settings)
  );

  return {
    ...getSubject(input),
    periods
  };
}

// =====================================
// ACTION 2: ALL STUDENTS
// =====================================

function getClassReport(book, input) {
  const students = getStudents(input);

  const reportStudents = getAllReportStudents(
    book,
    students
  );

  return {
    ...getSubject(input),
    total_students: reportStudents.length,
    students: reportStudents
  };
}

// =====================================
// ACTION 3: INDIVIDUAL STUDENT
// =====================================

function getStudentRecord(
  book,
  input,
  settings,
  studentNum
) {
  const students = getStudents(input);
  const index = buildStudentIndex(students);

  if (!studentNum) {
    throw studentRequestError("STUDENT_NUMBER_REQUIRED");
  }

  const student = index.byNumber.get(studentNum);

  if (!student) {
    throw studentRequestError("STUDENT_NUMBER_NOT_FOUND");
  }

  const reportStudents = getAllReportStudents(
    book,
    students
  );

  const reportRecord = reportStudents.find(
    row =>
      normalize(row.student_name) ===
      normalize(student.student_name)
  );

  if (!reportRecord) {
    throw studentRequestError("STUDENT_REPORT_NOT_FOUND");
  }

  const periods = CONFIG.periods.map(period =>
    readPeriod(
      book,
      period,
      input,
      settings,
      student.student_name
    )
  );

  return {
    student_num: student.student_num,
    student_name: student.student_name,
    ...getSubject(input),
    grades: reportRecord.grades,
    periods
  };
}

// =====================================
// MAIN API ENDPOINT
// =====================================

function doPost(e) {
  let studentRequest = false;
  try {
    if (!e || !e.postData) {
      throw new Error("POST body required");
    }

    const body = JSON.parse(
      e.postData.contents
    );

    // Validate shared API secret first.
    const secret = PropertiesService
      .getScriptProperties()
      .getProperty("API_SECRET");

    if (!secret || body.secret !== secret) {
      return json({
        success: false,
        error: "Unauthorized"
      });
    }

    const action = clean(
      body.action || "student"
    );
    studentRequest = action === "student";

    const spreadsheetId = clean(
      body.spreadsheetId
    );

    const supportedActions = [
      "student",
      "all_students",
      "all_classworks"
    ];

    if (!supportedActions.includes(action)) {
      throw new Error("Unsupported action");
    }

    if (
      !/^[a-zA-Z0-9_-]+$/.test(spreadsheetId)
    ) {
      throw new Error("Invalid spreadsheet ID");
    }

    const book = SpreadsheetApp.openById(
      spreadsheetId
    );

    const input = book.getSheetByName("INPUT");

    if (!input) {
      throw new Error("INPUT sheet not found");
    }

    const settings = getSettings(input);

    let data;

    switch (action) {
      case "all_classworks":
        data = getAllClassworks(
          book,
          input,
          settings
        );
        break;

      case "all_students":
        data = getClassReport(
          book,
          input
        );
        break;

      case "student":
        data = getStudentRecord(
          book,
          input,
          settings,
          clean(body.studentNum)
        );
        break;
    }

    return json({
      success: true,
      action,
      settings,
      data
    });

  } catch (error) {
    console.error(error);

    const response = {
      success: false,
      error: "Request could not be completed"
    };
    // Only fixed codes leave the script; never expose exception text or IDs.
    const studentErrorCodes = [
      "STUDENT_NUMBER_REQUIRED",
      "STUDENT_NUMBER_NOT_FOUND",
      "STUDENT_REPORT_NOT_FOUND",
      "STUDENT_RECORD_AMBIGUOUS"
    ];
    if (studentRequest && error && studentErrorCodes.includes(error.code)) {
      response.code = error.code;
    }
    return json(response);
  }
}
