import { optionalText } from "./validation";
import { EXISTING_STUDENT } from "./constants";
import { studentProfileFromSubmission } from "./student-fields";
import { addressDataFromProfile, guardianDataFromProfile, lastSchoolDataFromProfile, studentDataFromProfile } from "./profile-data";
import {
  ApplicantType,
  ApplicationStatus,
  ProgramType,
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

function parseDateInput(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value.");
  }

  return date;
}

function applicantTypeFromForm(value: string) {
  return value === EXISTING_STUDENT ? ApplicantType.existing : ApplicantType.new;
}

export async function saveAdmissionSubmission({
  submissionId,
  submittedAt,
  form,
  programSelection,
}: SaveAdmissionSubmissionInput) {
  const profile = studentProfileFromSubmission(form);

  await prisma.$transaction(async (tx) => {
    const studentAddress = await tx.address.create({
      data: addressDataFromProfile(profile, "address"),
    });

    const studentData = {
      ...studentDataFromProfile(profile, parseDateInput(form.student_birth_date)),
      addressId: studentAddress.id,
    };

    const student =
      form.applicant_type === EXISTING_STUDENT
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
        ...guardianDataFromProfile(profile),
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
      data: addressDataFromProfile(profile, "lastSchool"),
    });

    const lastSchool = await tx.lastSchool.create({
      data: {
        ...lastSchoolDataFromProfile(profile),
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
