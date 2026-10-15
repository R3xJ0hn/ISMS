import { optionalText } from "@/lib/utils";
import { isAcademicLevelAllowedForProgram } from "@/lib/academic-levels";
import { EXISTING_STUDENT } from "./constants";
import { addressDataFromProfile, guardianDataFromProfile, studentDataFromProfile, studentProfileFromSubmission } from "./student-fields";
import { resolveLastSchool, runLastSchoolTransaction } from "./last-school-store";
import {
  ApplicantType,
  ApplicationStatus,
  type AcademicLevel,
} from "@/lib/generated/prisma/enums";

export type CanonicalAdmissionProgramSelection = {
  branchId: bigint;
  branchCode: string;
  branchTitle: string;
  programId: bigint;
  programCode: string;
  programLabel: string;
  programType: string;
  academicLevel: AcademicLevel;
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

  await runLastSchoolTransaction(async (tx) => {
    const offering = await tx.branchProgram.findUnique({
      where: {
        branchId_programId: {
          branchId: programSelection.branchId,
          programId: programSelection.programId,
        },
      },
      select: {
        program: { select: { programType: true } },
      },
    });

    if (
      !offering ||
      offering.program.programType !== programSelection.programType ||
      !isAcademicLevelAllowedForProgram(offering.program.programType, programSelection.academicLevel)
    ) {
      throw new Error("The selected branch program has changed. Select an available program and try again.");
    }

    const studentAddress = await tx.address.create({
      data: addressDataFromProfile(profile, "address"),
    });

    const studentData = {
      ...studentDataFromProfile(profile, parseDateInput(profile.birthDate)),
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
        relationship: profile.guardianRelationship,
        isPrimary: true,
      },
    });

    const lastSchool = await resolveLastSchool(tx, profile, form.last_school_record_id);

    await tx.admissionApplication.create({
      data: {
        studentId: student.id,
        applicantType: applicantTypeFromForm(form.applicant_type),
        applicationStatus: ApplicationStatus.submitted,
        lastSchoolId: lastSchool.id,
        LSSchoolYearEnd: optionalText(profile.lastSchoolYear),
        LSAttainedLevelText: optionalText(profile.lastSchoolYearLevel),
        LSGraduationDate: profile.lastSchoolGraduationDate
          ? parseDateInput(profile.lastSchoolGraduationDate)
          : null,
        branchId: programSelection.branchId,
        programType: offering.program.programType,
        programId: programSelection.programId,
        academicLevel: programSelection.academicLevel,
        remarks: `Admission submission ${submissionId}`,
        submittedAt,
      },
    });
  });
}
