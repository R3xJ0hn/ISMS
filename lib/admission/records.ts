import { studentSubmissionFields, studentUpdateFields, type StudentSubmissionProfile, type StudentUpdateField } from "./student-fields";
import type { ReviewFormValues } from "./types";
import type { Prisma } from "@/lib/generated/prisma/client";
export const addressSelect = {
  houseNumber: true,
  subdivision: true,
  street: true,
  barangay: true,
  city: true,
  province: true,
  postalCode: true,
} as const satisfies Prisma.AddressSelect;
export const admittedStudentInclude = {
  academicLevels: {
    select: {
      label: true,
    },
  },
  branch: {
    select: {
      slug: true,
      title: true,
    },
  },
  program: {
    select: {
      code: true,
      label: true,
      programType: true,
    },
  },
  lastSchool: {
    select: {
      schoolName: true,
      schoolId: true,
      shortName: true,
      schoolType: true,
      address: {
        select: addressSelect,
      },
    },
  },
  student: {
    select: {
      email: true,
      birthDate: true,
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      phone: true,
      gender: true,
      civilStatus: true,
      citizenship: true,
      birthplace: true,
      religion: true,
      facebookAccount: true,
      studentNumber: true,
      suffix: true,
      address: {
        select: addressSelect,
      },
      guardians: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          relationship: true,
          guardian: {
            select: {
              firstName: true,
              lastName: true,
              middleName: true,
              suffix: true,
              contactNumber: true,
              occupation: true,
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.AdmissionApplicationInclude;
export type AdmittedStudentQueryResult = Prisma.AdmissionApplicationGetPayload<{
  include: typeof admittedStudentInclude;
}>;
export const studentUpdateSelect = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
  suffix: true,
  birthDate: true,
  gender: true,
  civilStatus: true,
  citizenship: true,
  birthplace: true,
  religion: true,
  email: true,
  phone: true,
  facebookAccount: true,
  address: {
    select: addressSelect,
  },
  guardians: {
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: {
      relationship: true,
      isPrimary: true,
      guardian: {
        select: {
          firstName: true,
          lastName: true,
          middleName: true,
          suffix: true,
          contactNumber: true,
          occupation: true,
        },
      },
    },
  },
  applications: {
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1,
    select: {
      id: true,
      branchId: true,
      programId: true,
      academicLevelsId: true,
      programType: true,
      lastSchoolId: true,
      LSSchoolYearEnd: true,
      LSAttainedLevelText: true,
      LSGraduationDate: true,
      applicationStatus: true,
      submittedAt: true,
      branch: {
        select: {
          title: true,
        },
      },
      program: {
        select: {
          label: true,
        },
      },
      academicLevels: {
        select: {
          label: true,
        },
      },
      lastSchool: {
        select: {
          schoolName: true,
          schoolId: true,
          shortName: true,
          schoolType: true,
          address: {
            select: addressSelect,
          },
        },
      },
    },
  },
  enrollments: {
    orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
    take: 1,
    select: {
      branchId: true,
      programId: true,
      academicLevelsId: true,
      enrollmentStatus: true,
      schoolYear: {
        select: {
          name: true,
        },
      },
      branch: {
        select: {
          title: true,
        },
      },
      program: {
        select: {
          label: true,
          programType: true,
        },
      },
      academicLevels: {
        select: {
          label: true,
        },
      },
      section: {
        select: {
          sectionName: true,
          sectionCode: true,
        },
      },
    },
  },
} as const satisfies Prisma.StudentSelect;
export type StudentUpdateQueryResult = Prisma.StudentGetPayload<{
  select: typeof studentUpdateSelect;
}>;


function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateInputValue(date: Date | null | undefined) {
  return date ? formatDateInput(date) : "";
}

function optionalValue(value: string | null | undefined) {
  return value ?? "";
}

type ProfileStudent = Omit<AdmittedStudentQueryResult["student"], "id" | "studentNumber">;
type ProfileApplication = Pick<AdmittedStudentQueryResult,
  "lastSchool" | "LSSchoolYearEnd" | "LSGraduationDate" | "LSAttainedLevelText"
>;

export function studentProfileFromRecord(
  student: ProfileStudent,
  application?: ProfileApplication,
  guardianLink = student.guardians[0]
) {
  const guardian = guardianLink?.guardian;
  const address = student.address;
  const lastSchool = application?.lastSchool;
  const lastSchoolAddress = lastSchool?.address;

  return {
    firstName: student.firstName,
    lastName: student.lastName,
    middleName: optionalValue(student.middleName),
    suffix: optionalValue(student.suffix),
    birthDate: formatDateInput(student.birthDate),
    gender: student.gender,
    civilStatus: student.civilStatus,
    citizenship: student.citizenship,
    birthplace: student.birthplace,
    religion: optionalValue(student.religion),
    email: student.email,
    phone: student.phone,
    facebookAccount: optionalValue(student.facebookAccount),
    addressHouseNumber: optionalValue(address?.houseNumber),
    addressSubdivision: optionalValue(address?.subdivision),
    addressStreet: optionalValue(address?.street),
    addressBarangay: optionalValue(address?.barangay),
    addressCity: optionalValue(address?.city),
    addressProvince: optionalValue(address?.province),
    addressPostalCode: optionalValue(address?.postalCode),
    guardianFirstName: optionalValue(guardian?.firstName),
    guardianLastName: optionalValue(guardian?.lastName),
    guardianMiddleName: optionalValue(guardian?.middleName),
    guardianSuffix: optionalValue(guardian?.suffix),
    guardianRelationship: optionalValue(guardianLink?.relationship),
    guardianContactNumber: optionalValue(guardian?.contactNumber),
    guardianOccupation: optionalValue(guardian?.occupation),
    lastSchoolName: optionalValue(lastSchool?.schoolName),
    lastSchoolId: optionalValue(lastSchool?.schoolId),
    lastSchoolShortName: optionalValue(lastSchool?.shortName),
    lastSchoolType: optionalValue(lastSchool?.schoolType),
    lastSchoolHouseNumber: optionalValue(lastSchoolAddress?.houseNumber),
    lastSchoolSubdivision: optionalValue(lastSchoolAddress?.subdivision),
    lastSchoolStreet: optionalValue(lastSchoolAddress?.street),
    lastSchoolBarangay: optionalValue(lastSchoolAddress?.barangay),
    lastSchoolCity: optionalValue(lastSchoolAddress?.city),
    lastSchoolProvince: optionalValue(lastSchoolAddress?.province),
    lastSchoolPostalCode: optionalValue(lastSchoolAddress?.postalCode),
    lastSchoolYear: optionalValue(application?.LSSchoolYearEnd),
    lastSchoolGraduationDate: dateInputValue(application?.LSGraduationDate),
    lastSchoolYearLevel: optionalValue(application?.LSAttainedLevelText),
  };
}

export function serializeAdmittedStudent(application: AdmittedStudentQueryResult) {
  const profile = Object.fromEntries(Object.entries(
    studentProfileFromRecord(application.student, application)
  ).map(([field, value]) => [field, value ?? ""])) as Record<StudentUpdateField, string>;
  const reviewProfile = Object.fromEntries(studentUpdateFields.map(
    (field) => [studentSubmissionFields[field], profile[field]]
  )) as StudentSubmissionProfile;
  const reviewForm = {
    ...reviewProfile,
    applicant_type: application.applicantType,
    branch_id: application.branchId.toString(),
    branch_code: application.branch.slug,
    branch_title: application.branch.title,
    program_type: application.program.programType,
    program_code: application.program.code,
    program_label: application.program.label,
    academic_level_label: application.academicLevels.label,
    current_student_record_id: "",
    current_student_verified_name: "",
    current_student_verified_school_year: "",
    current_student_verified_program: "",
    current_student_verified_branch: "",
  } satisfies ReviewFormValues;

  return {
    applicationId: application.id.toString(),
    studentId: application.student.id.toString(),
    applicantType: application.applicantType,
    branchId: application.branchId.toString(),
    programId: application.programId.toString(),
    academicLevelsId: application.academicLevelsId.toString(),
    studentNumber: application.student.studentNumber ?? "",
    ...profile,
    reviewForm,
  };
}

export type AdmittedStudentPayload = ReturnType<typeof serializeAdmittedStudent>;
