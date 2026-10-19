import { prisma } from "@/lib/prisma";
import { getCurrentStudent, studentClassMembershipWhere } from "@/lib/portal/student";
import type { Semester } from "@/lib/generated/prisma/enums";
import type { StudentGrade } from "@/lib/student-grades";
import { getClassPeriodVisibility, getVisiblePeriodGrades, type ClassPeriodVisibility } from "./period-visibility";

export type SemesterClassVisibility = ClassPeriodVisibility & {
  semester: Semester | null;
  subjectName: string;
  subject: { code: string | null; name: string } | null;
};

export type VisibleSemesterGrade = Omit<StudentGrade, "raw"> & {
  periodVisibility: ClassPeriodVisibility;
};

function normalizeSubject(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function matchesSubject(grade: StudentGrade, assignedClass: SemesterClassVisibility) {
  const gradeCode = normalizeSubject(grade.code);
  const classCode = normalizeSubject(assignedClass.subject?.code);
  // A supplied code identifies the subject more precisely than its display name.
  if (gradeCode && classCode) return gradeCode === classCode;
  const name = normalizeSubject(grade.subject);
  return Boolean(name) && [assignedClass.subjectName, assignedClass.subject?.name]
    .some((candidate) => normalizeSubject(candidate) === name);
}

export function filterSemesterGradesByVisibility(
  grades: readonly StudentGrade[],
  classes: readonly SemesterClassVisibility[],
  requestedSemester?: Semester,
): VisibleSemesterGrade[] {
  return grades.map((grade) => {
    const matches = classes.filter((assignedClass) =>
      (!requestedSemester || !assignedClass.semester || assignedClass.semester === requestedSemester) &&
      matchesSubject(grade, assignedClass)
    );
    const periodVisibility = matches.reduce<ClassPeriodVisibility>((visibility, assignedClass) => {
      const assignedVisibility = getClassPeriodVisibility(assignedClass);
      return {
        prelimVisible: visibility.prelimVisible && assignedVisibility.prelimVisible,
        midtermVisible: visibility.midtermVisible && assignedVisibility.midtermVisible,
        prefinalsVisible: visibility.prefinalsVisible && assignedVisibility.prefinalsVisible,
        finalsVisible: visibility.finalsVisible && assignedVisibility.finalsVisible,
      };
    }, getClassPeriodVisibility());
    // Rebuild the public row explicitly. The source's raw object can also contain
    // period grades and must never reach the table through a different property.
    return {
      subject: grade.subject,
      code: grade.code,
      units: grade.units,
      instructor_id: grade.instructor_id,
      instructor_name: grade.instructor_name,
      ...getVisiblePeriodGrades(grade, periodVisibility),
      periodVisibility,
    };
  });
}

export async function getStudentSemesterGradeVisibility() {
  const student = await getCurrentStudent();
  if (!student) return { student: null, classes: [] };
  const classes = await prisma.class.findMany({
    where: studentClassMembershipWhere(student.id),
    select: {
      semester: true,
      subjectName: true,
      subject: { select: { code: true, name: true } },
      prelimVisible: true,
      midtermVisible: true,
      prefinalsVisible: true,
      finalsVisible: true,
    },
  });
  return { student, classes };
}
