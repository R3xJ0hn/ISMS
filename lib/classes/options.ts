import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatStudentName } from "@/lib/utils";
import { getEmployeeFullName } from "@/lib/employees/names";

export async function getClassFormOptions() {
  await requireSuperAdmin();
  const [teachers, students, branches, programs, subjects] = await Promise.all([
    prisma.teacher.findMany({
      where: { user: { role: "teacher", emailVerified: true } },
      orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }, { employeeId: "asc" }],
      select: { employeeId: true, employee: { select: { firstName: true, middleName: true, lastName: true, suffix: true } }, user: { select: { email: true } } },
    }),
    prisma.student.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      select: { id: true, studentNumber: true, firstName: true, middleName: true, lastName: true, suffix: true },
    }),
    prisma.branch.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.program.findMany({
      orderBy: [{ label: "asc" }, { id: "asc" }],
      select: { id: true, code: true, label: true, programType: true, branchPrograms: { select: { branchId: true } }, programSubjects: { select: { subjectId: true } } },
    }),
    prisma.subject.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, code: true } }),
  ]);
  return {
    teachers: teachers.map((teacher) => ({ id: teacher.employeeId.toString(), name: getEmployeeFullName(teacher.employee), email: teacher.user.email })),
    students: students.map((student) => ({ id: student.id.toString(), name: formatStudentName(student), studentNumber: student.studentNumber })),
    branches: branches.map((branch) => ({ id: branch.id.toString(), title: branch.title })),
    programs: programs.map((program) => ({ id: program.id.toString(), code: program.code, label: program.label, programType: program.programType, branchIds: program.branchPrograms.map((entry) => entry.branchId.toString()), subjectIds: program.programSubjects.map((entry) => entry.subjectId.toString()) })),
    subjects: subjects.map((subject) => ({ id: subject.id.toString(), name: subject.name, code: subject.code })),
  };
}
