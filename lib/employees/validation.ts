import type { Employee } from "@/lib/generated/prisma/client";
import { CivilStatus, EmployeeStatus, Gender, type EmployeeRole } from "@/lib/generated/prisma/enums";
import { isEmployeeRole } from "./roles";
import { capitalizeInputText, enumIncludes, normalizeEmail, nullableInputText, parseRecordId, readFormFields, readFormText, sanitizeInputText } from "@/lib/utils";
import { parseDateInput, validateEmail, validatePhone } from "@/lib/validation";

export const employeeFields = [
  "employeeId", "firstName", "lastName", "middleName", "suffix", "birthDate", "placeOfBirth", "gender", "civilStatus", "nationality",
  "address", "contactNumber", "emailAddress", "tin", "sssNo", "philHealthNo", "pagIbigNo",
  "dateStarted", "role", "status",
] as const;

export type EmployeeFormValues = Record<typeof employeeFields[number], string>;
export type EmployeeFormState = {
  success: boolean;
  message: string;
  fieldErrors?: Partial<Record<keyof EmployeeFormValues | "employeeRecordId", string>>;
};
export const emptyEmployeeFormValues = Object.fromEntries(employeeFields.map((field) => [field, ""])) as EmployeeFormValues;
export const employeeFieldLabels: EmployeeFormValues = {
  employeeId: "Employee ID", firstName: "First name", lastName: "Last name", middleName: "Middle name", suffix: "Suffix",
  birthDate: "Birth date", placeOfBirth: "Place of birth",
  gender: "Gender", civilStatus: "Civil status", nationality: "Nationality", address: "Address",
  contactNumber: "Contact number", emailAddress: "Email address", tin: "TIN", sssNo: "SSS number",
  philHealthNo: "PhilHealth number", pagIbigNo: "Pag-IBIG number", dateStarted: "Date started", role: "Role", status: "Status",
};
export const employeeTextLimits = {
  employeeId: 100, firstName: 250, lastName: 250, middleName: 250, suffix: 50, placeOfBirth: 250, nationality: 100, address: 1000,
  contactNumber: 32, emailAddress: 320, tin: 100, sssNo: 100, philHealthNo: 100, pagIbigNo: 100,
} as const;

export type EmployeeWriteData = Pick<Employee, keyof EmployeeFormValues>;
type EmployeeFormFailure = EmployeeFormState & { success: false };
type EmployeeFormSuccess = { success: true; id?: bigint; data: EmployeeWriteData };
const optionalFields: ReadonlySet<string> = new Set(["middleName", "suffix", "tin", "sssNo", "philHealthNo", "pagIbigNo"]);
const humanTextFields: ReadonlySet<string> = new Set(["firstName", "lastName", "middleName", "suffix", "placeOfBirth", "nationality", "address"]);
const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila",
});

export function parseEmployeeRecordId(value: string): bigint | null {
  return parseRecordId(value, { maxDigits: 19 });
}

export function parseEmployeeForm(formData: FormData, mode: "edit", referenceDate?: Date):
  EmployeeFormFailure | (EmployeeFormSuccess & { id: bigint });
export function parseEmployeeForm(formData: FormData, mode: "create" | "edit", referenceDate?: Date):
  EmployeeFormFailure | EmployeeFormSuccess;
export function parseEmployeeForm(formData: FormData, mode: "create" | "edit", referenceDate = new Date()):
  EmployeeFormFailure | EmployeeFormSuccess {
  const values = readFormFields(formData, employeeFields);
  for (const field of employeeFields) {
    values[field] = humanTextFields.has(field) ? capitalizeInputText(values[field]) : sanitizeInputText(values[field]);
  }
  values.emailAddress = normalizeEmail(values.emailAddress);
  const fieldErrors: NonNullable<EmployeeFormState["fieldErrors"]> = {};
  const id = mode === "edit" ? parseEmployeeRecordId(readFormText(formData, "employeeRecordId")) : null;
  if (mode === "edit" && id === null) fieldErrors.employeeRecordId = "Choose an existing employee record.";

  for (const field of employeeFields) {
    if (!optionalFields.has(field) && !values[field]) fieldErrors[field] = `${employeeFieldLabels[field]} is required.`;
  }
  for (const [field, maximum] of Object.entries(employeeTextLimits) as Array<[keyof typeof employeeTextLimits, number]>) {
    if (values[field].length > maximum) fieldErrors[field] = `Use up to ${maximum} characters for ${employeeFieldLabels[field].toLowerCase()}.`;
  }

  if (!enumIncludes(Gender, values.gender)) fieldErrors.gender = "Select a valid gender.";
  if (!enumIncludes(CivilStatus, values.civilStatus)) fieldErrors.civilStatus = "Select a valid civil status.";
  if (!isEmployeeRole(values.role)) fieldErrors.role = "Select a valid employee role.";
  if (!enumIncludes(EmployeeStatus, values.status)) fieldErrors.status = "Select a valid employment status.";
  if (!validateEmail(values.emailAddress)) fieldErrors.emailAddress = "Enter a valid email address.";
  if (!validatePhone(values.contactNumber)) fieldErrors.contactNumber = "Enter a valid contact number.";

  const birthDate = parseDateInput(values.birthDate);
  const dateStarted = parseDateInput(values.dateStarted);
  const todayParts = Object.fromEntries(dateFormatter.formatToParts(referenceDate).map(({ type, value }) => [type, value]));
  const today = parseDateInput(`${todayParts.year}-${todayParts.month}-${todayParts.day}`)!;
  if (!birthDate) fieldErrors.birthDate = "Enter a valid birth date.";
  else if (birthDate > today) fieldErrors.birthDate = "Birth date cannot be in the future.";
  if (!dateStarted) fieldErrors.dateStarted = "Enter a valid date started.";
  else if (birthDate && dateStarted < birthDate) fieldErrors.dateStarted = "Date started cannot be before the birth date.";

  if (Object.keys(fieldErrors).length || !birthDate || !dateStarted) {
    return { success: false, message: "Check the highlighted fields.", fieldErrors };
  }
  return {
    success: true,
    ...(id !== null ? { id } : {}),
    data: {
      employeeId: values.employeeId, firstName: values.firstName, lastName: values.lastName,
      middleName: values.middleName || null, suffix: nullableInputText(values.suffix), birthDate, placeOfBirth: values.placeOfBirth,
      gender: values.gender as Gender, civilStatus: values.civilStatus as CivilStatus, nationality: values.nationality,
      address: values.address, contactNumber: values.contactNumber, emailAddress: values.emailAddress,
      tin: values.tin || null, sssNo: values.sssNo || null, philHealthNo: values.philHealthNo || null, pagIbigNo: values.pagIbigNo || null,
      dateStarted, role: values.role as EmployeeRole, status: values.status as EmployeeStatus,
    },
  };
}
