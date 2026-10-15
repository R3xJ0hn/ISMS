import { requireSession } from "@/lib/auth";
import { getEmployeeFullName } from "@/lib/employees/names";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatAddress, formatDateInput, formatStudentName, literalInsensitiveEquality, normalizeEmail, parseRecordId } from "@/lib/utils";
import { findStudentByEmail } from "./student";
import { redirect } from "next/navigation";

const nameSelection = { firstName: true, middleName: true, lastName: true, suffix: true } as const;

const employeeSelection = {
  ...nameSelection,
  employeeId: true,
  birthDate: true,
  placeOfBirth: true,
  gender: true,
  civilStatus: true,
  nationality: true,
  address: true,
  contactNumber: true,
  emailAddress: true,
  dateStarted: true,
  role: true,
  status: true,
} as const satisfies Prisma.EmployeeSelect;

const studentSelection = {
  ...nameSelection,
  studentNumber: true,
  birthDate: true,
  gender: true,
  civilStatus: true,
  citizenship: true,
  birthplace: true,
  religion: true,
  email: true,
  phone: true,
  facebookAccount: true,
  address: { select: {
    houseNumber: true, street: true, subdivision: true, barangay: true,
    city: true, province: true, postalCode: true,
  } },
  guardians: {
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      relationship: true,
      guardian: { select: { ...nameSelection, contactNumber: true, occupation: true } },
    },
  },
  applications: {
    orderBy: [{ submittedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
    take: 1,
    select: {
      academicLevel: true,
      programType: true,
      applicantType: true,
      applicationStatus: true,
      submittedAt: true,
      branch: { select: { title: true } },
      program: { select: { label: true } },
      LSSchoolYearEnd: true,
      LSAttainedLevelText: true,
      LSGraduationDate: true,
      lastSchool: { select: { schoolName: true, schoolType: true } },
    },
  },
} as const satisfies Prisma.StudentSelect;

type EmployeeRecord = Prisma.EmployeeGetPayload<{ select: typeof employeeSelection }>;
type StudentRecord = Prisma.StudentGetPayload<{ select: typeof studentSelection }>;

function teacherInformation(employee: EmployeeRecord) {
  return {
    kind: "teacher" as const,
    name: getEmployeeFullName(employee),
    personal: {
      birthDate: formatDateInput(employee.birthDate),
      birthplace: employee.placeOfBirth,
      gender: employee.gender,
      civilStatus: employee.civilStatus,
      nationality: employee.nationality,
      religion: null,
    },
    contact: {
      email: employee.emailAddress,
      phone: employee.contactNumber,
      address: employee.address,
      facebookAccount: null,
    },
    employment: {
      employeeId: employee.employeeId,
      dateStarted: formatDateInput(employee.dateStarted),
      role: employee.role,
      status: employee.status,
    },
  };
}

function studentInformation(student: StudentRecord) {
  const guardian = student.guardians[0];
  const application = student.applications[0];
  const address = student.address;
  return {
    kind: "student" as const,
    name: formatStudentName(student),
    studentNumber: student.studentNumber,
    personal: {
      birthDate: formatDateInput(student.birthDate),
      birthplace: student.birthplace,
      gender: student.gender,
      civilStatus: student.civilStatus,
      nationality: student.citizenship,
      religion: student.religion,
    },
    contact: {
      email: student.email,
      phone: student.phone,
      address: address ? formatAddress(address) : null,
      facebookAccount: student.facebookAccount,
    },
    guardian: guardian ? {
      name: formatStudentName(guardian.guardian),
      relationship: guardian.relationship,
      phone: guardian.guardian.contactNumber,
      occupation: guardian.guardian.occupation,
    } : null,
    admission: application ? {
      branch: application.branch.title,
      program: application.program.label,
      yearLevel: application.academicLevel,
      programType: application.programType,
      status: application.applicationStatus,
      applicantType: application.applicantType,
      submittedAt: application.submittedAt ? formatDateInput(application.submittedAt) : null,
      lastSchool: application.lastSchool ? {
        name: application.lastSchool.schoolName,
        type: application.lastSchool.schoolType,
        schoolYear: application.LSSchoolYearEnd,
        attainedLevel: application.LSAttainedLevelText,
        graduationDate: application.LSGraduationDate ? formatDateInput(application.LSGraduationDate) : null,
      } : null,
    } : null,
  };
}

export type TeacherInformation = ReturnType<typeof teacherInformation>;
export type StudentInformation = ReturnType<typeof studentInformation>;
export type MyInformation = {
  role: "teacher" | "student";
  accountEmail: string;
  profile: TeacherInformation | StudentInformation | null;
};

/** Reads the signed-in user's own saved information. No URL or form identity is accepted. */
export async function getMyInformation(): Promise<MyInformation> {
  const session = await requireSession();
  if (session.role !== "teacher" && session.role !== "student") redirect("/portal");
  const information: MyInformation = { role: session.role, accountEmail: session.email, profile: null };

  if (session.role === "teacher") {
    const userId = parseRecordId(session.id);
    if (userId === null) return information;
    const teacher = await prisma.teacher.findUnique({
      where: { userId, user: { role: "teacher", emailVerified: true } },
      select: { employee: { select: employeeSelection } },
    });
    return { ...information, profile: teacher ? teacherInformation(teacher.employee) : null };
  }

  const email = normalizeEmail(session.email);
  if (!email) return information;
  const identity = await findStudentByEmail(email, { id: true });
  if (!identity) return information;
  const student = await prisma.student.findFirst({
    where: { id: identity.id, email: literalInsensitiveEquality(email) }, select: studentSelection,
  });
  return { ...information, profile: student ? studentInformation(student) : null };
}
