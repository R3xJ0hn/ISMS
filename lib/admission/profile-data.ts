import type { CivilStatus, Gender, SchoolType } from "@/lib/generated/prisma/enums";
import type { UpdateStudentRecordInput } from "./student-fields";
import { optionalText } from "./validation";

export function addressDataFromProfile(input: UpdateStudentRecordInput, prefix: "address" | "lastSchool") {
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
  return {
    firstName: input.guardianFirstName,
    lastName: input.guardianLastName,
    middleName: optionalText(input.guardianMiddleName),
    suffix: optionalText(input.guardianSuffix),
    contactNumber: input.guardianContactNumber,
    occupation: optionalText(input.guardianOccupation),
  };
}

export function lastSchoolDataFromProfile(input: UpdateStudentRecordInput) {
  return {
    schoolName: input.lastSchoolName,
    schoolId: optionalText(input.lastSchoolId),
    shortName: optionalText(input.lastSchoolShortName),
    schoolType: input.lastSchoolType as SchoolType,
  };
}

export function studentDataFromProfile(input: UpdateStudentRecordInput, birthDate: Date) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: optionalText(input.middleName),
    suffix: optionalText(input.suffix),
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
