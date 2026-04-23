import {
  ApplicantType,
  ApplicationStatus,
  CivilStatus,
  Gender,
  ProgramType,
  SchoolType,
} from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type CanonicalAdmissionProgramSelection = {
  branchId: bigint;
  branchCode: string;
  branchTitle: string;
  programId: bigint;
  programCode: string;
  programLabel: string;
  programType: string;
  academicLevelsId: bigint;
  academicLevelLabel: string;
};

export type SaveAdmissionSubmissionInput = {
  submissionId: string;
  submittedAt: Date;
  form: Record<string, string>;
  programSelection: CanonicalAdmissionProgramSelection;
};

function optionalText(value: string) {
  return value ? value : null;
}

function parseDateInput(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return date;
}

function applicantTypeFromForm(value: string) {
  return value === "Existing Student" ? ApplicantType.existing : ApplicantType.new;
}

export async function saveAdmissionSubmission({
  submissionId,
  submittedAt,
  form,
  programSelection,
}: SaveAdmissionSubmissionInput) {
  await prisma.$transaction(async (tx) => {
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
      form.applicant_type === "Existing Student"
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
        applicantType: applicantTypeFromForm(form.applicant_type),
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
