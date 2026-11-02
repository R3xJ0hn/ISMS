/** Shared class calendar projection. No runtime semester or quarter catalog. */
export const academicSelection = {
  academicTermId: true,
  academicTerm: {
    select: {
      name: true,
      position: true,
      schemeId: true,
      averageColumn: true,
      equivalentColumn: true,
      scheme: { select: { name: true, legacySpreadsheet: true } },
      periods: {
        orderBy: { position: "asc" as const },
        select: {
          id: true,
          key: true,
          name: true,
          worksheetName: true,
          reportColumn: true,
          position: true,
        },
      },
    },
  },
  gradingPeriods: { select: { gradingPeriodId: true, visible: true } },
} as const;

export type CalendarPeriod = {
  id: string;
  key: string;
  name: string;
  worksheetName: string;
  reportColumn: number;
  visible: boolean;
};
export type ClassCalendar = {
  termId: string;
  name: string;
  position: number;
  scheme: string;
  legacySpreadsheet?: boolean;
  averageColumn: number;
  equivalentColumn: number;
  periods: CalendarPeriod[];
};
type CalendarSource = {
  academicTermId: bigint;
  academicTerm: {
    name: string;
    position: number;
    averageColumn: number;
    equivalentColumn: number;
    scheme: { name: string; legacySpreadsheet?: boolean };
    periods: {
      id: bigint;
      key: string;
      name: string;
      worksheetName: string;
      reportColumn: number;
      position: number;
    }[];
  };
  gradingPeriods: { gradingPeriodId: bigint; visible: boolean }[];
};
export function getClassCalendar(row: CalendarSource): ClassCalendar {
  const visibility = new Map(
    row.gradingPeriods.map((period) => [
      String(period.gradingPeriodId),
      period.visible,
    ]),
  );
  return {
    termId: String(row.academicTermId),
    name: row.academicTerm.name,
    position: row.academicTerm.position,
    scheme: row.academicTerm.scheme.name,
    legacySpreadsheet: row.academicTerm.scheme.legacySpreadsheet === true,
    averageColumn: row.academicTerm.averageColumn,
    equivalentColumn: row.academicTerm.equivalentColumn,
    periods: row.academicTerm.periods.map((period) => ({
      id: String(period.id),
      key: period.key,
      name: period.name,
      worksheetName: period.worksheetName,
      reportColumn: period.reportColumn,
      visible: visibility.get(String(period.id)) === true,
    })),
  };
}
/** Include mapping in request keys and race checks, not just spreadsheet identity. */
export function calendarVersion(calendar: ClassCalendar) {
  return JSON.stringify([
    calendar.termId,
    calendar.legacySpreadsheet === true,
    calendar.averageColumn,
    calendar.equivalentColumn,
    calendar.periods.map(({ id, key, name, worksheetName, reportColumn }) => [
      id,
      key,
      name,
      worksheetName,
      reportColumn,
    ]),
  ]);
}
export function termOptions(rows: readonly { term?: string | null }[]) {
  return [
    ...new Set(
      rows
        .map((row) => row.term)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((value) => ({ value, label: value }));
}
export function formatTerm(value: string | null | undefined) {
  return value || "Term not assigned";
}
