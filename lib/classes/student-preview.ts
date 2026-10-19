import type { Prisma } from "@/lib/generated/prisma/client";
import { formatStudentName } from "@/lib/utils";

export const classStudentPreviewLimit = 4;

export type ClassStudentPreview = { id: string; name: string; imageUrl: string | null };

export type ClassRosterProfile = { id: string; name: string; studentNumber: string | null; imageUrl?: string | null };

/** Photos may be joined only by a unique exact student number within the assigned class. */
export function matchClassStudentProfiles(
  rows: readonly { studentNumber: string }[],
  roster: readonly ClassRosterProfile[],
): Map<string, ClassRosterProfile> {
  const rowCounts = new Map<string, number>();
  for (const row of rows) {
    const number = row.studentNumber.trim();
    if (number) rowCounts.set(number, (rowCounts.get(number) ?? 0) + 1);
  }
  const profiles = new Map<string, ClassRosterProfile>();
  const ambiguous = new Set<string>();
  for (const student of roster) {
    const number = student.studentNumber?.trim();
    if (!number || rowCounts.get(number) !== 1 || ambiguous.has(number)) continue;
    const previous = profiles.get(number);
    if (previous && previous.id !== student.id) {
      profiles.delete(number);
      ambiguous.add(number);
    } else if (!previous) profiles.set(number, student);
  }
  return profiles;
}

// Class cards and tables need only a few display profiles, even with a large roster.
export const classStudentPreviewSelection = {
  students: {
    take: classStudentPreviewLimit,
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
      { studentId: "asc" },
    ],
    select: { student: { select: {
      id: true, firstName: true, middleName: true, lastName: true, suffix: true, userImage: true,
    } } },
  },
  _count: { select: { students: true } },
} satisfies Prisma.ClassSelect;

type PreviewMembership = Prisma.ClassGetPayload<{ select: typeof classStudentPreviewSelection }>["students"][number];

export function serializeClassStudentPreviews(students: readonly PreviewMembership[]): ClassStudentPreview[] {
  return students.slice(0, classStudentPreviewLimit).map(({ student }) => ({
    id: student.id.toString(),
    name: formatStudentName(student),
    imageUrl: student.userImage,
  }));
}
