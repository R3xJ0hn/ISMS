import type { ReviewFormValues } from "@/lib/admission/types";
import type { PortalAdmittedStudentRecord } from "@/app/portal/admission/admitted-student-actions";
import type { AdmittedStudentEditRecord } from "@/app/portal/admission/edit-admitted-student-form";

type SerializableAdmittedApplication = {
  id: bigint;
  applicantType: string;
  branchId: bigint;
  programId: bigint;
  academicLevelsId: bigint;
  LSSchoolYearEnd: string | null;
  LSAttainedLevelText: string | null;
  LSGraduationDate: Date | null;
  branch: {
    slug: string;
    title: string;
  };
  program: {
    code: string;
    label: string;
    programType: string;
  };
  academicLevels: {
    label: string;
  };
  student: {
    id: bigint;
    studentNumber: string | null;
    firstName: string;
    lastName: string;
    middleName: string | null;
    suffix: string | null;
    birthDate: Date;
    gender: string | null;
    civilStatus: string | null;
    citizenship: string | null;
    birthplace: string | null;
    religion: string | null;
    email: string;
    phone: string | null;
    facebookAccount: string | null;
    address: {
      houseNumber: string | null;
      subdivision: string | null;
      street: string | null;
      barangay: string;
      city: string;
      province: string;
      postalCode: string | null;
    } | null;
    guardians: Array<{
      relationship: string;
      guardian: {
        firstName: string;
        lastName: string;
        middleName: string | null;
        suffix: string | null;
        contactNumber: string;
        occupation: string | null;
      };
    }>;
  };
  lastSchool: {
    schoolName: string;
    schoolId: string | null;
    shortName: string | null;
    schoolType: string;
    address: {
      houseNumber: string | null;
      subdivision: string | null;
      street: string | null;
      barangay: string;
      city: string;
      province: string;
      postalCode: string | null;
    } | null;
  } | null;
};

export type AdmittedStudentPayload = PortalAdmittedStudentRecord &
  AdmittedStudentEditRecord;

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
  application: SerializableAdmittedApplication
): AdmittedStudentPayload {
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
