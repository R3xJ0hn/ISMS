import { createHash } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { getEmployeeFullName } from "@/lib/employees/names";
import type { Semester } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getRosterDatabaseStudents, rosterStudentSelection } from "./roster-data";
import { compareClassRoster, type DatabaseRosterStudent } from "./roster-cross-match";
import { getClassRoster, type ClassRosterResult } from "./spreadsheet";
import { getSpreadsheetId } from "./validation";

export type ClassRosterReview = {
  id: string;
  classCode: string;
  subjectName: string;
  sectionName: string;
  schoolYear: string;
  semester: Semester | null;
  teacherName: string;
  state: "needs_review" | "matched" | "unavailable" | "not_connected";
  severity: "warning" | "attention" | null;
  issueCount: number | null;
  issueRows: number | null;
  missingStudents: number | null;
  nameDifferences: number | null;
  message: string | null;
  checkedAt: string | null;
};

export type ClassRosterReviewReport = { checkedAt: string; classes: ClassRosterReview[] };
type CachedRoster = { checkedAt: string; result: ClassRosterResult };
const rosterCacheTag = "class-roster-review";
const unavailableMessage = "Unable to load this class roster right now. Please try again later.";
const databaseUnavailableMessage = "Unable to compare saved student records right now. Please try again later.";

/** Cache only remote INPUT snapshots. Membership and database identities are always read fresh. */
export async function getClassRosterReviewReport({ refresh = false }: { refresh?: boolean } = {}): Promise<ClassRosterReviewReport> {
  await requireSuperAdmin();
  if (refresh) revalidateTag(rosterCacheTag, { expire: 0 });
  const connectionKey = createHash("sha256").update(JSON.stringify([
    process.env.GOOGLE_SCRIPT_URL ?? "", process.env.GOOGLE_SCRIPT_SECRET ?? "",
  ])).digest("hex");
  const cachedRoster = unstable_cache(async (sheetId: string): Promise<CachedRoster> => ({
    checkedAt: new Date().toISOString(),
    result: await getClassRoster(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`),
  }), ["class-roster-review-v1", connectionKey], { revalidate: 120, tags: [rosterCacheTag] });
  const records = await prisma.class.findMany({
    where: { teacher: { user: { role: { not: "superAdmin" } } } },
    orderBy: [{ schoolYear: "desc" }, { sectionName: "asc" }, { subjectName: "asc" }, { id: "asc" }],
    select: {
      id: true, classCode: true, subjectName: true, sectionName: true, schoolYear: true, semester: true,
      spreadsheetUrl: true,
      teacher: { select: { employee: { select: { firstName: true, middleName: true, lastName: true, suffix: true } } } },
      students: { select: { student: { select: rosterStudentSelection } } },
    },
  });
  const checkedAt = new Date().toISOString();
  const sheetIds = [...new Set(records.flatMap((record) => {
    const sheetId = record.spreadsheetUrl ? getSpreadsheetId(record.spreadsheetUrl) : null;
    return sheetId ? [sheetId] : [];
  }))];
  const snapshots = new Map<string, CachedRoster>();
  let nextSheet = 0;
  await Promise.all(Array.from({ length: Math.min(3, sheetIds.length) }, async () => {
    while (nextSheet < sheetIds.length) {
      const sheetId = sheetIds[nextSheet++];
      try { snapshots.set(sheetId, await cachedRoster(sheetId)); }
      catch { snapshots.set(sheetId, { checkedAt: new Date().toISOString(), result: { success: false, message: unavailableMessage } }); }
    }
  }));
  const sheetRows = [...snapshots.values()].flatMap((snapshot) => snapshot.result.success ? snapshot.result.students : []);
  let databaseStudents: DatabaseRosterStudent[] | null;
  try {
    databaseStudents = await getRosterDatabaseStudents(sheetRows, records.flatMap((record) => record.students.map(({ student }) => student)));
  } catch { databaseStudents = null; }

  const classes = records.map((record): ClassRosterReview => {
    const review: ClassRosterReview = {
      id: record.id.toString(), classCode: record.classCode, subjectName: record.subjectName,
      sectionName: record.sectionName, schoolYear: record.schoolYear, semester: record.semester,
      teacherName: getEmployeeFullName(record.teacher.employee), state: "not_connected", severity: null,
      issueCount: null, issueRows: null, missingStudents: null, nameDifferences: null,
      message: null, checkedAt: null,
    };
    if (!record.spreadsheetUrl?.trim()) return review;
    const sheetId = getSpreadsheetId(record.spreadsheetUrl);
    const snapshot = sheetId ? snapshots.get(sheetId) : null;
    review.checkedAt = snapshot?.checkedAt ?? checkedAt;
    if (!snapshot || !snapshot.result.success) {
      return { ...review, state: "unavailable", message: snapshot?.result.success === false ? snapshot.result.message : "This class does not have a valid Google Sheets link. Ask an administrator to check it." };
    }
    if (!databaseStudents) return { ...review, state: "unavailable", message: databaseUnavailableMessage };
    try {
      const comparison = compareClassRoster(snapshot.result.students, databaseStudents, record.students.map(({ student }) => student.id.toString()));
      const attention = comparison.missingStudents.length > 0 || comparison.rows.some((row) => row.issues.some((issue) => issue !== "name_mismatch"));
      return {
        ...review, state: comparison.issueCount ? "needs_review" : "matched",
        severity: comparison.issueCount ? attention ? "attention" : "warning" : null,
        issueCount: comparison.issueCount, issueRows: comparison.rows.filter((row) => row.issues.length).length,
        missingStudents: comparison.missingStudents.length,
        nameDifferences: comparison.rows.filter((row) => row.issues.includes("name_mismatch")).length,
      };
    } catch { return { ...review, state: "unavailable", message: databaseUnavailableMessage }; }
  });
  return { checkedAt, classes };
}
