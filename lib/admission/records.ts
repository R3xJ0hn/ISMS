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

function dateInputValue(date: Date | null) {
  return date ? formatDateInput(date) : "";
}

function optionalValue(value: string | null | undefined) {
  return value ?? "";
}

export function serializeAdmittedStudent(
  application: AdmittedStudentQueryResult
) {
  const guardianLink = application.student.guardians[0];
  const guardian = guardianLink?.guardian;
  const address = application.student.address;
  const lastSchool = application.lastSchool;
  const lastSchoolAddress = lastSchool?.address;
  const studentNumber = application.student.studentNumber ?? "";
  const birthDate = formatDateInput(application.student.birthDate);
  const graduationDate = dateInputValue(application.LSGraduationDate);
  const reviewForm = {
    applicant_type: application.applicantType,
    branch_id: application.branchId.toString(),
    branch_code: application.branch.slug,
    branch_title: application.branch.title,
    program_type: application.program.programType,
    program_code: application.program.code,
    program_label: application.program.label,
    academic_level_label: application.academicLevels.label,
    student_first_name: application.student.firstName,
    student_last_name: application.student.lastName,
    student_middle_name: optionalValue(application.student.middleName),
    student_suffix: optionalValue(application.student.suffix),
    student_birth_date: birthDate,
    student_gender: optionalValue(application.student.gender),
    student_civil_status: optionalValue(application.student.civilStatus),
    student_citizenship: optionalValue(application.student.citizenship),
    student_birthplace: optionalValue(application.student.birthplace),
    student_religion: optionalValue(application.student.religion),
    contact_email: application.student.email,
    contact_phone: optionalValue(application.student.phone),
    contact_facebook: optionalValue(application.student.facebookAccount),
    address_house_number: optionalValue(address?.houseNumber),
    address_subdivision: optionalValue(address?.subdivision),
    address_street: optionalValue(address?.street),
    address_barangay: optionalValue(address?.barangay),
    address_city: optionalValue(address?.city),
    address_province: optionalValue(address?.province),
    address_postal_code: optionalValue(address?.postalCode),
    last_school_name: optionalValue(lastSchool?.schoolName),
    last_school_id: optionalValue(lastSchool?.schoolId),
    last_school_short_name: optionalValue(lastSchool?.shortName),
    last_school_type: optionalValue(lastSchool?.schoolType),
    last_school_house_number: optionalValue(lastSchoolAddress?.houseNumber),
    last_school_subdivision: optionalValue(lastSchoolAddress?.subdivision),
    last_school_street: optionalValue(lastSchoolAddress?.street),
    last_school_barangay: optionalValue(lastSchoolAddress?.barangay),
    last_school_city: optionalValue(lastSchoolAddress?.city),
    last_school_province: optionalValue(lastSchoolAddress?.province),
    last_school_postal_code: optionalValue(lastSchoolAddress?.postalCode),
    last_school_year: optionalValue(application.LSSchoolYearEnd),
    last_school_graduation_date: graduationDate,
    last_school_year_level: optionalValue(application.LSAttainedLevelText),
    guardian_last_name: optionalValue(guardian?.lastName),
    guardian_first_name: optionalValue(guardian?.firstName),
    guardian_middle_name: optionalValue(guardian?.middleName),
    guardian_suffix: optionalValue(guardian?.suffix),
    guardian_relationship: optionalValue(guardianLink?.relationship),
    guardian_contact_number: optionalValue(guardian?.contactNumber),
    guardian_occupation: optionalValue(guardian?.occupation),
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
    studentNumber,
    firstName: application.student.firstName,
    lastName: application.student.lastName,
    middleName: optionalValue(application.student.middleName),
    suffix: optionalValue(application.student.suffix),
    birthDate,
    gender: optionalValue(application.student.gender),
    civilStatus: optionalValue(application.student.civilStatus),
    citizenship: optionalValue(application.student.citizenship),
    birthplace: optionalValue(application.student.birthplace),
    religion: optionalValue(application.student.religion),
    email: application.student.email,
    phone: optionalValue(application.student.phone),
    facebookAccount: optionalValue(application.student.facebookAccount),
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
    lastSchoolYear: optionalValue(application.LSSchoolYearEnd),
    lastSchoolGraduationDate: graduationDate,
    lastSchoolYearLevel: optionalValue(application.LSAttainedLevelText),
    reviewForm,
  };
}

export type AdmittedStudentPayload = ReturnType<typeof serializeAdmittedStudent>;

