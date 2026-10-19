import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatClassRosterName, type DatabaseRosterStudent, type SheetRosterStudent } from "./roster-cross-match";

export const rosterStudentSelection = {
  id: true, studentNumber: true, firstName: true, middleName: true, lastName: true, suffix: true,
} satisfies Prisma.StudentSelect;

export type RosterDatabaseRecord = Prisma.StudentGetPayload<{ select: typeof rosterStudentSelection }>;

export type RosterStudentImage = { id: string; imageUrl: string | null };

// PostgreSQL btrim must remove the same boundary characters as JavaScript trim.
const numberBoundaryWhitespace = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";

/** Internal to authorized class services; return identities only, never profile or grade data. */
export async function getRosterDatabaseStudents(
  sheetRows: readonly SheetRosterStudent[],
  enrolledRecords: readonly RosterDatabaseRecord[],
): Promise<DatabaseRosterStudent[]> {
  const numbers = [...new Set(sheetRows.map((student) => student.studentNumber.trim()).filter(Boolean))];
  const candidates = numbers.length ? await prisma.$queryRaw<RosterDatabaseRecord[]>(Prisma.sql`
    SELECT "id", "student_number" AS "studentNumber", "first_name" AS "firstName",
      "middle_name" AS "middleName", "last_name" AS "lastName", "suffix"
    FROM "students"
    WHERE btrim("student_number", ${numberBoundaryWhitespace}) IN (${Prisma.join(numbers)})
  `) : [];
  const records = new Map<bigint, RosterDatabaseRecord>();
  for (const student of [...enrolledRecords, ...candidates]) {
    if (!records.has(student.id)) records.set(student.id, student);
  }
  return [...records.values()].map((student) => ({
    id: student.id.toString(), studentNumber: student.studentNumber, name: formatClassRosterName(student),
    firstName: student.firstName, lastName: student.lastName,
  }));
}

/** Read photos only for identities resolved by an already authorized class comparison. */
export async function getRosterDatabaseStudentImages(ids: readonly string[]): Promise<RosterStudentImage[]> {
  const studentIds = [...new Set(ids)].map((id) => BigInt(id));
  if (!studentIds.length) return [];
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, userImage: true },
  });
  return students.map((student) => ({ id: student.id.toString(), imageUrl: student.userImage }));
}
