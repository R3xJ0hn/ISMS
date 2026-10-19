import type { ClassSummaryStudent } from "./spreadsheet";
import { matchClassStudentProfiles, type ClassRosterProfile } from "./student-preview";

export type ClassStudentGrades = Pick<ClassSummaryStudent,
  "prelim" | "midterm" | "prefinals" | "finals" | "average" | "remarks" | "note">;

export type EnrolledClassStudent = ClassRosterProfile & {
  imageUrl: string | null;
  grades: ClassStudentGrades | null;
};

/** Keep enrollment authoritative; attach grades only through unambiguous student numbers. */
export function mergeEnrolledStudentGrades(
  roster: readonly ClassRosterProfile[], summary: readonly ClassSummaryStudent[],
): EnrolledClassStudent[] {
  const profiles = matchClassStudentProfiles(summary, roster);
  const grades = new Map<string, ClassStudentGrades>();
  for (const row of summary) {
    const profile = profiles.get(row.studentNumber.trim());
    if (profile) grades.set(profile.id, {
      prelim: row.prelim, midterm: row.midterm, prefinals: row.prefinals,
      finals: row.finals, average: row.average, remarks: row.remarks, note: row.note,
    });
  }
  return roster.map((student) => ({
    id: student.id, name: student.name, studentNumber: student.studentNumber,
    imageUrl: student.imageUrl ?? null, grades: grades.get(student.id) ?? null,
  }));
}
