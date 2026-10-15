import { CivilStatus, Gender, SchoolType } from "@/lib/generated/prisma/enums";
import { capitalizeInputText, normalizeEmail, nullableInputText, optionalText, sanitizeInputText, enumIncludes } from "@/lib/utils";
import { parseDateInput, validateEmail, validatePhone } from "@/lib/validation";

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
const capitalizedFields: ReadonlySet<StudentUpdateField> = new Set([
  "firstName", "lastName", "middleName", "suffix", "citizenship", "birthplace", "religion",
  "addressSubdivision", "addressStreet", "addressBarangay", "addressCity", "addressProvince",
  "guardianFirstName", "guardianLastName", "guardianMiddleName", "guardianSuffix",
  "guardianRelationship", "guardianOccupation", "lastSchoolName", "lastSchoolShortName",
  "lastSchoolSubdivision", "lastSchoolStreet", "lastSchoolBarangay", "lastSchoolCity",
  "lastSchoolProvince", "lastSchoolYearLevel",
]);

export type UpdateStudentRecordInput = Record<Exclude<StudentUpdateField, NullableStudentUpdateField>, string> &
  Partial<Record<NullableStudentUpdateField, string | null>>;

export function isCapitalizedStudentField(field: string): field is StudentUpdateField {
  return capitalizedFields.has(field as StudentUpdateField);
}

/** Human-readable fields use capitalized words; enum, contact, date and identifier values retain their format. */
export function normalizeStudentField(field: StudentUpdateField, value: unknown) {
  if (field === "email") return normalizeEmail(sanitizeInputText(value));
  if (field === "suffix" || field === "guardianSuffix") return capitalizeInputText(nullableInputText(value) ?? "");
  return capitalizedFields.has(field) ? capitalizeInputText(value) : sanitizeInputText(value);
}

export function studentProfileFromSubmission(form: Record<string, string>) {
  return Object.fromEntries(Object.entries(studentSubmissionFields).map(
    ([field, submissionField]) => [field, normalizeStudentField(field as StudentUpdateField, form[submissionField])]
  )) as Record<StudentUpdateField, string>;
}

export function normalizeStudentUpdateInput(input: UpdateStudentRecordInput): UpdateStudentRecordInput {
  return Object.fromEntries(studentUpdateFields.map((field) => {
    const value = normalizeStudentField(field, input[field]);
    return [field, nullableFieldSet.has(field) ? value || null : value];
  })) as UpdateStudentRecordInput;
}

export function addressDataFromProfile(input: UpdateStudentRecordInput, prefix: "address" | "lastSchool") {
  input = normalizeStudentUpdateInput(input);
  return {
    houseNumber: optionalText(input[`${prefix}HouseNumber`]),
    subdivision: optionalText(input[`${prefix}Subdivision`]),
    street: optionalText(input[`${prefix}Street`]),
    barangay: input[`${prefix}Barangay`],
    city: input[`${prefix}City`],
    province: input[`${prefix}Province`],
    postalCode: optionalText(input[`${prefix}PostalCode`]),
  };
}

export function guardianDataFromProfile(input: UpdateStudentRecordInput) {
  input = normalizeStudentUpdateInput(input);
  return {
    firstName: input.guardianFirstName,
    lastName: input.guardianLastName,
    middleName: optionalText(input.guardianMiddleName),
    suffix: nullableInputText(input.guardianSuffix),
    contactNumber: input.guardianContactNumber,
    occupation: optionalText(input.guardianOccupation),
  };
}

export function lastSchoolDataFromProfile(input: UpdateStudentRecordInput) {
  input = normalizeStudentUpdateInput(input);
  return {
    schoolName: input.lastSchoolName,
    schoolId: optionalText(input.lastSchoolId),
    shortName: optionalText(input.lastSchoolShortName),
    schoolType: input.lastSchoolType as SchoolType,
  };
}

export function studentDataFromProfile(input: UpdateStudentRecordInput, birthDate: Date) {
  input = normalizeStudentUpdateInput(input);
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: optionalText(input.middleName),
    suffix: nullableInputText(input.suffix),
    birthDate,
    gender: (input.gender || null) as Gender | null,
    civilStatus: (input.civilStatus || null) as CivilStatus | null,
    citizenship: optionalText(input.citizenship ?? ""),
    birthplace: input.birthplace,
    religion: optionalText(input.religion),
    email: input.email,
    phone: input.phone,
    facebookAccount: optionalText(input.facebookAccount),
  };
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
