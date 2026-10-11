import { CivilStatus, Gender, SchoolType } from "@/lib/generated/prisma/enums";
import { normalizeText } from "@/lib/utils";
import { enumIncludes, parseDateInput, validateEmail, validatePhone } from "./validation";

// The public application uses snake case; record edit forms use these camel case keys.
export const studentSubmissionFields = {
  firstName: "student_first_name",
  lastName: "student_last_name",
  middleName: "student_middle_name",
  suffix: "student_suffix",
  birthDate: "student_birth_date",
  gender: "student_gender",
  civilStatus: "student_civil_status",
  citizenship: "student_citizenship",
  birthplace: "student_birthplace",
  religion: "student_religion",
  email: "contact_email",
  phone: "contact_phone",
  facebookAccount: "contact_facebook",
  addressHouseNumber: "address_house_number",
  addressSubdivision: "address_subdivision",
  addressStreet: "address_street",
  addressBarangay: "address_barangay",
  addressCity: "address_city",
  addressProvince: "address_province",
  addressPostalCode: "address_postal_code",
  guardianFirstName: "guardian_first_name",
  guardianLastName: "guardian_last_name",
  guardianMiddleName: "guardian_middle_name",
  guardianSuffix: "guardian_suffix",
  guardianRelationship: "guardian_relationship",
  guardianContactNumber: "guardian_contact_number",
  guardianOccupation: "guardian_occupation",
  lastSchoolName: "last_school_name",
  lastSchoolId: "last_school_id",
  lastSchoolShortName: "last_school_short_name",
  lastSchoolType: "last_school_type",
  lastSchoolHouseNumber: "last_school_house_number",
  lastSchoolSubdivision: "last_school_subdivision",
  lastSchoolStreet: "last_school_street",
  lastSchoolBarangay: "last_school_barangay",
  lastSchoolCity: "last_school_city",
  lastSchoolProvince: "last_school_province",
  lastSchoolPostalCode: "last_school_postal_code",
  lastSchoolYear: "last_school_year",
  lastSchoolGraduationDate: "last_school_graduation_date",
  lastSchoolYearLevel: "last_school_year_level",
} as const;

export type StudentUpdateField = keyof typeof studentSubmissionFields;
export type StudentSubmissionProfile = Record<(typeof studentSubmissionFields)[StudentUpdateField], string>;
export const studentUpdateFields = Object.keys(studentSubmissionFields) as readonly StudentUpdateField[];
const nullableFields = ["gender", "civilStatus", "citizenship", "birthplace", "phone"] as const;
type NullableStudentUpdateField = (typeof nullableFields)[number];
const nullableFieldSet: ReadonlySet<string> = new Set(nullableFields);

export type UpdateStudentRecordInput = Record<Exclude<StudentUpdateField, NullableStudentUpdateField>, string> &
  Partial<Record<NullableStudentUpdateField, string | null>>;

export function studentProfileFromSubmission(form: Record<string, string>) {
  return Object.fromEntries(Object.entries(studentSubmissionFields).map(
    ([field, submissionField]) => [field, form[submissionField]]
  )) as Record<StudentUpdateField, string>;
}

export function normalizeStudentUpdateInput(input: UpdateStudentRecordInput): UpdateStudentRecordInput {
  return Object.fromEntries(studentUpdateFields.map((field) => {
    const value = normalizeText(input[field]);
    return [field, nullableFieldSet.has(field) ? value || null : value];
  })) as UpdateStudentRecordInput;
}

const requiredUpdateFields: StudentUpdateField[] = [
  "firstName", "lastName", "birthDate", "email", "addressBarangay", "addressCity", "addressProvince",
  "guardianFirstName", "guardianLastName", "guardianRelationship", "guardianContactNumber",
  "lastSchoolName", "lastSchoolType", "lastSchoolBarangay", "lastSchoolCity", "lastSchoolProvince",
  "lastSchoolYear", "lastSchoolYearLevel",
];

export function firstInvalidStudentUpdateField(input: UpdateStudentRecordInput) {
  const missingField = requiredUpdateFields.find((field) => !input[field]);
  if (missingField) return missingField;

  if (!parseDateInput(input.birthDate)) return "birthDate";
  if (input.gender && !enumIncludes(Gender, input.gender)) return "gender";
  if (input.civilStatus && !enumIncludes(CivilStatus, input.civilStatus)) return "civilStatus";
  if (!validateEmail(input.email)) return "email";
  if (input.phone && !validatePhone(input.phone)) return "phone";
  if (!validatePhone(input.guardianContactNumber)) return "guardianContactNumber";
  if (!enumIncludes(SchoolType, input.lastSchoolType)) return "lastSchoolType";
  return null;
}
