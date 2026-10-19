import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getClassRosterComparison, type ClassRosterCrossMatchResult } from "./roster-comparison";
import { rosterStudentSelection } from "./roster-data";
import { getClassSummary, type ClassSummaryResult } from "./spreadsheet";
import { parseClassId } from "./validation";

const classViewSelection = {
  id: true, classCode: true, status: true, subjectName: true, sectionName: true,
  schoolYear: true, semester: true, yearLevel: true, spreadsheetUrl: true,
  branch: { select: { title: true } },
  program: { select: { code: true, label: true } },
  teacher: { select: { employee: { select: { firstName: true, middleName: true, lastName: true, suffix: true } } } },
  students: {
    orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }, { studentId: "asc" }],
    select: { student: { select: { ...rosterStudentSelection, userImage: true } } },
  },
} satisfies Prisma.ClassSelect;

export type ManagedClassCrossMatch = ClassRosterCrossMatchResult;

/** Authorize before reads, then load only the spreadsheet data needed by the selected tab. */
export async function getManagedClassView(classId: string, includeCrossMatch = false) {
  await requireSuperAdmin();
  const id = parseClassId(classId);
  if (id === null) return null;

  const record = await prisma.class.findFirst({
    where: { id, teacher: { user: { role: { not: "superAdmin" } } } },
    select: classViewSelection,
  });
  if (!record) return null;

  let crossMatch: ManagedClassCrossMatch | null = null;
  let summary: ClassSummaryResult | null = null;
  if (!includeCrossMatch) {
    if (!record.spreadsheetUrl) {
      summary = { success: false, message: "Ask the teacher to connect a Google Sheet from the class Overview to view grades." };
    } else {
      try {
        summary = await getClassSummary(record.spreadsheetUrl);
      } catch {
        console.error("Failed to load the class grade summary.");
        summary = { success: false, message: "Unable to load class grades right now. Please refresh to try again." };
      }
    }
  }
  if (includeCrossMatch) {
    crossMatch = await getClassRosterComparison(record.spreadsheetUrl, record.students.map(({ student }) => student));
  }
  return { record, crossMatch, summary };
}
