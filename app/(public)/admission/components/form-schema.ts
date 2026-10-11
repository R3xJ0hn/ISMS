import type { StudentUpdateRecord } from "@/lib/admission/student-update";
import { civilStatusOptions, genderOptions, schoolTypeOptions } from "./config";
import type { FormFieldDefinition } from "./form-fields";

type AdmissionField = FormFieldDefinition & {
  updateId: keyof StudentUpdateRecord;
  updateLabel?: string;
  updateRequired?: boolean;
  hideFromUpdate?: boolean;
};

const studentFields = [
  { id: "student_first_name", updateId: "firstName", label: "First name", autoComplete: "given-name", required: true },
  { id: "student_last_name", updateId: "lastName", label: "Last name", autoComplete: "family-name", required: true },
  { id: "student_middle_name", updateId: "middleName", label: "Middle name", autoComplete: "additional-name" },
  { id: "student_suffix", updateId: "suffix", label: "Suffix", placeholder: "Example: Jr, III" },
  { id: "student_birth_date", updateId: "birthDate", label: "Birth date", type: "date", autoComplete: "bday", required: true },
  { id: "student_gender", updateId: "gender", label: "Gender", placeholder: "Select gender", options: genderOptions, required: true, updateRequired: false },
  { id: "student_civil_status", updateId: "civilStatus", label: "Civil status", placeholder: "Select civil status", options: civilStatusOptions, required: true, updateRequired: false },
  { id: "student_citizenship", updateId: "citizenship", label: "Citizenship", placeholder: "Example: Filipino", required: true, updateRequired: false },
  { id: "student_birthplace", updateId: "birthplace", label: "Birthplace", placeholder: "City / Province / Country", required: true, updateRequired: false },
  { id: "student_religion", updateId: "religion", label: "Religion" },
] as const satisfies readonly AdmissionField[];

const contactFields = [
  { id: "contact_email", updateId: "email", label: "Email address", updateLabel: "Email", type: "email", placeholder: "name@example.com", autoComplete: "email", required: true },
  { id: "contact_phone", updateId: "phone", label: "Mobile number", updateLabel: "Phone", type: "tel", placeholder: "09xx xxx xxxx", autoComplete: "tel", required: true, updateRequired: false },
  { id: "contact_facebook", updateId: "facebookAccount", label: "Facebook profile", updateLabel: "Facebook account", placeholder: "Optional" },
] as const satisfies readonly AdmissionField[];

const addressFields = [
  { id: "address_house_number", updateId: "addressHouseNumber", label: "House number / unit", autoComplete: "address-line1" },
  { id: "address_subdivision", updateId: "addressSubdivision", label: "Subdivision / village" },
  { id: "address_street", updateId: "addressStreet", label: "Street", autoComplete: "address-line2" },
  { id: "address_barangay", updateId: "addressBarangay", label: "Barangay", required: true },
  { id: "address_city", updateId: "addressCity", label: "City / municipality", autoComplete: "address-level2", required: true },
  { id: "address_province", updateId: "addressProvince", label: "Province", autoComplete: "address-level1", required: true },
  { id: "address_postal_code", updateId: "addressPostalCode", label: "Postal code", autoComplete: "postal-code" },
] as const satisfies readonly AdmissionField[];

const guardianFields = [
  { id: "guardian_first_name", updateId: "guardianFirstName", label: "First name", autoComplete: "given-name", required: true },
  { id: "guardian_last_name", updateId: "guardianLastName", label: "Last name", autoComplete: "family-name", required: true },
  { id: "guardian_middle_name", updateId: "guardianMiddleName", label: "Middle name", autoComplete: "additional-name" },
  { id: "guardian_suffix", updateId: "guardianSuffix", label: "Suffix", placeholder: "Optional" },
  { id: "guardian_relationship", updateId: "guardianRelationship", label: "Relationship to student", placeholder: "Example: Mother, Father, Aunt", required: true },
  { id: "guardian_contact_number", updateId: "guardianContactNumber", label: "Contact number", type: "tel", placeholder: "09xx xxx xxxx", autoComplete: "tel", required: true },
  { id: "guardian_occupation", updateId: "guardianOccupation", label: "Occupation", placeholder: "Optional" },
] as const satisfies readonly AdmissionField[];

const schoolFields = [
  { id: "last_school_name", updateId: "lastSchoolName", label: "School name", required: true },
  { id: "last_school_short_name", updateId: "lastSchoolShortName", label: "Short name", placeholder: "Optional" },
  { id: "last_school_id", updateId: "lastSchoolId", label: "School ID", placeholder: "Optional" },
  { id: "last_school_type", updateId: "lastSchoolType", label: "School type", placeholder: "Select school type", options: schoolTypeOptions, required: true },
] as const satisfies readonly AdmissionField[];

const schoolAddressFields = [
  { id: "last_school_house_number", updateId: "lastSchoolHouseNumber", label: "House number / unit", hideFromUpdate: true },
  { id: "last_school_subdivision", updateId: "lastSchoolSubdivision", label: "Subdivision / village", hideFromUpdate: true },
  { id: "last_school_street", updateId: "lastSchoolStreet", label: "Street", hideFromUpdate: true },
  { id: "last_school_barangay", updateId: "lastSchoolBarangay", label: "Barangay", required: true },
  { id: "last_school_city", updateId: "lastSchoolCity", label: "City / municipality", required: true },
  { id: "last_school_province", updateId: "lastSchoolProvince", label: "Province", required: true },
  { id: "last_school_postal_code", updateId: "lastSchoolPostalCode", label: "Postal code" },
] as const satisfies readonly AdmissionField[];

const schoolAcademicFields = [
  { id: "last_school_year", updateId: "lastSchoolYear", label: "Last school year attended", placeholder: "Example: 2025-2026", required: true },
  { id: "last_school_year_level", updateId: "lastSchoolYearLevel", label: "Year level completed", placeholder: "Example: Grade 12 / First Year", required: true },
  { id: "last_school_graduation_date", updateId: "lastSchoolGraduationDate", label: "Graduation date", type: "date", hint: "Leave blank if not yet graduated." },
] as const satisfies readonly AdmissionField[];

export type DetailsFieldName = (
  | typeof studentFields | typeof contactFields | typeof addressFields
  | typeof guardianFields | typeof schoolFields | typeof schoolAddressFields
  | typeof schoolAcademicFields
)[number]["id"];

export type DetailsStepId = "student" | "contact" | "guardian" | "lastSchool";

export const currentStudentFields = [
  { id: "current_student_number", label: "Student number", placeholder: "Example: 2612345", autoComplete: "off" },
  { id: "current_student_email", label: "Student email", type: "email", placeholder: "name@example.com", autoComplete: "email" },
  { id: "current_student_first_name", label: "First name", autoComplete: "given-name" },
  { id: "current_student_last_name", label: "Last name", autoComplete: "family-name" },
  { id: "current_student_birth_date", label: "Birth date", type: "date", autoComplete: "bday" },
] as const satisfies readonly FormFieldDefinition[];

export type CurrentStudentFieldName = (typeof currentStudentFields)[number]["id"];

export const detailsSteps: Record<DetailsStepId, {
  title: string;
  description: string;
  sections: { title?: string; fields: readonly FormFieldDefinition<DetailsFieldName>[] }[];
}> = {
  student: {
    title: "Student information",
    description: "Enter the applicant's legal and personal details exactly as they appear on school and government records.",
    sections: [{ fields: studentFields }],
  },
  contact: {
    title: "Contact and address",
    description: "Provide the active contact details and current home address the registrar should use for updates and document requests.",
    sections: [{ title: "Contact details", fields: contactFields }, { title: "Home address", fields: addressFields }],
  },
  guardian: {
    title: "Parent or guardian",
    description: "Enter the primary parent or guardian the school should contact for support, urgent matters, and admission follow-up.",
    sections: [{ fields: guardianFields }],
  },
  lastSchool: {
    title: "Previous school",
    description: "Provide the school most recently attended before this admission application. These details help the registrar review eligibility and admission requirements.",
    sections: [
      { title: "School details", fields: schoolFields },
      { title: "School address", fields: schoolAddressFields },
      { title: "Academic details", fields: schoolAcademicFields },
    ],
  },
};

function updateFields(fields: readonly AdmissionField[]): FormFieldDefinition<keyof StudentUpdateRecord>[] {
  return fields.filter((field) => !field.hideFromUpdate).map((field) => ({
    id: field.updateId,
    label: field.updateLabel ?? field.label,
    type: field.type,
    required: field.updateRequired ?? field.required,
    options: field.options,
    placeholder: field.options && (field.updateRequired ?? field.required) ? field.placeholder : undefined,
  }));
}

export const studentUpdateSections = [
  { title: "Personal details", fields: updateFields(studentFields) },
  { title: "Contact details", fields: updateFields(contactFields) },
  { title: "Home address", fields: updateFields(addressFields) },
  { title: "Parent or guardian", fields: updateFields(guardianFields) },
  { title: "Last school attended", fields: updateFields([...schoolFields, ...schoolAddressFields, ...schoolAcademicFields]) },
];
