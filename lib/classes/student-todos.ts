import { getStudentRecordReport } from "./student";
import { isAdditionalPointsActivity } from "./presentation";
import type { ClassworkCatalogResult } from "./spreadsheet";
export type StudentTodoClass = {
  id: string;
  classCode: string;
  subjectName: string;
  sectionName: string;
  schoolYear: string;
  term: string;
  classwork: ClassworkCatalogResult;
};
export type StudentTodosReport = {
  classes: StudentTodoClass[];
  message: string | null;
};
export async function getStudentTodos(): Promise<StudentTodosReport> {
  const report = await getStudentRecordReport({ ongoing: true });
  return {
    message: report.message,
    classes: report.classes.map(({ row, result }) => ({
      id: String(row.id),
      classCode: row.classCode,
      subjectName: row.subjectName,
      sectionName: row.sectionName,
      schoolYear: row.schoolYear,
      term: row.academicTerm.name,
      classwork: !result.success
        ? result
        : {
            success: true,
            periods: result.periods
              .map((period) => ({
                ...period,
                categories: period.categories
                  .map((category) => ({
                    ...category,
                    activities: category.activities.filter(
                      (activity) =>
                        !activity.isAdditionalPoints &&
                        !isAdditionalPointsActivity(activity.name) &&
                        (activity.score == null || !activity.score.trim()),
                    ),
                  }))
                  .filter((c) => c.activities.length),
              }))
              .filter((p) => p.categories.length),
          },
    })),
  };
}
