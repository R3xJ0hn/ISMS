import "server-only";

import { compareClassRoster, type ClassRosterComparison } from "./roster-cross-match";
import { getRosterDatabaseStudentImages, getRosterDatabaseStudents, type RosterDatabaseRecord, type RosterStudentImage } from "./roster-data";
import { getClassRoster } from "./spreadsheet";

export type ClassRosterCrossMatchResult =
  | { success: true; comparison: ClassRosterComparison; profiles?: RosterStudentImage[] }
  | { success: false; message: string };

/** Server callers must authorize access to this class before supplying its sheet and enrolled records. */
export async function getClassRosterComparison(
  spreadsheetUrl: string | null,
  enrolled: readonly RosterDatabaseRecord[],
): Promise<ClassRosterCrossMatchResult> {
  if (!spreadsheetUrl?.trim()) {
    return { success: false, message: "Connect a Google Sheet from the class Overview before comparing student lists." };
  }
  try {
    const roster = await getClassRoster(spreadsheetUrl);
    if (!roster.success) return roster;
    const databaseStudents = await getRosterDatabaseStudents(roster.students, enrolled);
    const comparison = compareClassRoster(roster.students, databaseStudents, enrolled.map((student) => student.id.toString()));
    const profileIds = [...new Set([
      ...comparison.rows.flatMap((row) => row.databaseId ? [row.databaseId] : []),
      ...comparison.missingStudents.map((student) => student.id),
    ])];
    let profiles: RosterStudentImage[] = [];
    if (profileIds.length) {
      try {
        profiles = await getRosterDatabaseStudentImages(profileIds);
      } catch {
        // Photos are optional; preserve useful comparison results and initials.
        console.error("Failed to load class roster profile images.");
      }
    }
    return { success: true, comparison, profiles };
  } catch {
    console.error("Failed to compare the class roster.");
    return { success: false, message: "Unable to compare the saved student records right now. Please refresh to try again." };
  }
}
