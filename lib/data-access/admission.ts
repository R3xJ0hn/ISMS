import { allowedAcademicLevelSlugsByProgramType } from "@/lib/admission/constants";
import type { CanonicalAdmissionProgramSelection, SaveAdmissionSubmissionInput } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { ApplicantType, ApplicationStatus, CivilStatus, Gender, SchoolType, type ProgramType, type ProgramType as ProgramTypeValue } from "@/lib/generated/prisma/enums";
import { optionalText, parseDateInput } from "../utils";

export async function getCanonicalAdmissionProgramSelectionByIds({
  branchId,
  programId,
  academicLevelsId,
  programType,
}: {
  branchId: bigint;
  programId: bigint;
  academicLevelsId: bigint;
  programType: string;
}): Promise<CanonicalAdmissionProgramSelection | null> {
  const offering = await prisma.section.findFirst({
    where: {
      branchId,
      programId,
      academicLevelsId,
    },
    select: {
      branch: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
      program: {
        select: {
          id: true,
          code: true,
          label: true,
          programType: true,
        },
      },
      academicLevels: {
        select: {
          id: true,
          label: true,
          slug: true,
        },
      },
    },
  });

  if (!offering) {
    return null;
  }

  const { branch, program, academicLevels: academicLevel } = offering;
  const allowedAcademicLevelSlugs =
    allowedAcademicLevelSlugsByProgramType[program.programType];

  if (
    program.programType !== programType ||
    !allowedAcademicLevelSlugs.includes(academicLevel.slug)
  ) {
    return null;
  }

  return {
    branchId: branch.id,
    branchCode: branch.slug,
    branchTitle: branch.title,
    programId: program.id,
    programCode: program.code,
    programLabel: program.label,
    programType: program.programType satisfies ProgramTypeValue,
    academicLevelsId: academicLevel.id,
    academicLevelLabel: academicLevel.label,
  };
}

export async function findStudentForAdmissionVerification({
  branchId,
  studentNumber,
  studentEmail,
  birthDate,
}: {
  branchId: bigint;
  studentNumber: string;
  studentEmail: string;
  birthDate: Date;
}) {
  return prisma.student.findFirst({
    where: {
      studentNumber,
      email: {
        equals: studentEmail,
        mode: "insensitive",
      },
      birthDate,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      suffix: true,
      enrollments: {
        where: {
          branchId,
        },
        orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
        take: 1,
        select: {
          schoolYear: {
            select: {
              name: true,
            },
          },
          branch: {
            select: {
              id: true,
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
          section: {
            select: {
              sectionCode: true,
              sectionName: true,
            },
          },
        },
      },
      applications: {
        where: {
          branchId,
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
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
        },
      },
    },
  });
}

export async function findExistingStudentVerificationRecord({
  recordId,
  branchId,
}: {
  recordId: bigint;
  branchId: bigint;
}) {
  return prisma.student.findUnique({
    where: {
      id: recordId,
    },
    select: {
      studentNumber: true,
      email: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      enrollments: {
        where: {
          branchId,
        },
        orderBy: [{ schoolYearId: "desc" }, { enrolledAt: "desc" }],
        take: 1,
        select: {
          schoolYear: {
            select: {
              name: true,
            },
          },
          branchId: true,
        },
      },
      applications: {
        where: {
          branchId,
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          branchId: true,
        },
      },
    },
  });
}

export async function saveAdmissionSubmission({
  submissionId,
  submittedAt,
  form,
  programSelection,
}: SaveAdmissionSubmissionInput) {
  await prisma.$transaction(async (tx) => {
    const isExistingStudent = form.applicant_type === "Existing Student";
    const studentAddress = await tx.address.create({
      data: {
        houseNumber: optionalText(form.address_house_number),
        subdivision: optionalText(form.address_subdivision),
        street: optionalText(form.address_street),
        barangay: form.address_barangay,
        city: form.address_city,
        province: form.address_province,
        postalCode: optionalText(form.address_postal_code),
      },
    });

    const studentData = {
      firstName: form.student_first_name,
      lastName: form.student_last_name,
      middleName: optionalText(form.student_middle_name),
      suffix: optionalText(form.student_suffix),
      birthDate: parseDateInput(form.student_birth_date),
      gender: form.student_gender as (typeof Gender)[keyof typeof Gender],
      civilStatus: form.student_civil_status as (typeof CivilStatus)[keyof typeof CivilStatus],
      citizenship: form.student_citizenship,
      birthplace: form.student_birthplace,
      religion: optionalText(form.student_religion),
      email: form.contact_email,
      phone: form.contact_phone,
      facebookAccount: optionalText(form.contact_facebook),
      addressId: studentAddress.id,
    };

    const student =
      isExistingStudent
        ? await tx.student.update({
            where: {
              id: BigInt(form.current_student_record_id),
            },
            data: studentData,
          })
        : await tx.student.create({
            data: {
              ...studentData,
              studentNumber: null,
            },
          });

    const guardian = await tx.guardian.create({
      data: {
        firstName: form.guardian_first_name,
        lastName: form.guardian_last_name,
        middleName: optionalText(form.guardian_middle_name),
        suffix: optionalText(form.guardian_suffix),
        contactNumber: form.guardian_contact_number,
        occupation: optionalText(form.guardian_occupation),
        email: null,
        addressId: null,
        facebookAccount: null,
      },
    });

    await tx.studentGuardian.create({
      data: {
        studentId: student.id,
        guardianId: guardian.id,
        relationship: form.guardian_relationship,
        isPrimary: true,
      },
    });

    const lastSchoolAddress = await tx.address.create({
      data: {
        houseNumber: optionalText(form.last_school_house_number),
        subdivision: optionalText(form.last_school_subdivision),
        street: optionalText(form.last_school_street),
        barangay: form.last_school_barangay,
        city: form.last_school_city,
        province: form.last_school_province,
        postalCode: optionalText(form.last_school_postal_code),
      },
    });

    const lastSchool = await tx.lastSchool.create({
      data: {
        schoolName: form.last_school_name,
        schoolId: optionalText(form.last_school_id),
        shortName: optionalText(form.last_school_short_name),
        schoolType: form.last_school_type as (typeof SchoolType)[keyof typeof SchoolType],
        addressId: lastSchoolAddress.id,
      },
    });

    await tx.admissionApplication.create({
      data: {
        studentId: student.id,
        applicantType: isExistingStudent
          ? ApplicantType.existing
          : ApplicantType.new,
        applicationStatus: ApplicationStatus.submitted,
        lastSchoolId: lastSchool.id,
        LSSchoolYearEnd: optionalText(form.last_school_year),
        LSAttainedLevelText: optionalText(form.last_school_year_level),
        LSGraduationDate: form.last_school_graduation_date
          ? parseDateInput(form.last_school_graduation_date)
          : null,
        branchId: programSelection.branchId,
        programType: programSelection.programType as (typeof ProgramType)[keyof typeof ProgramType],
        programId: programSelection.programId,
        academicLevelsId: programSelection.academicLevelsId,
        remarks: `Admission submission ${submissionId}`,
        submittedAt,
      },
    });
  });
}