import type { Prisma } from "@/lib/generated/prisma/client";
import { formatDateInput } from "@/lib/utils";
import { employeeFields, type EmployeeFormValues } from "./validation";
import { getEmployeeFullName } from "./names";

export const employeeOverviewSelect = {
  id: true, employeeId: true, firstName: true, lastName: true, middleName: true, suffix: true,
  emailAddress: true, contactNumber: true, role: true, status: true, dateStarted: true,
} as const satisfies Prisma.EmployeeSelect;
export const employeeEditSelect = {
  ...employeeOverviewSelect, birthDate: true, placeOfBirth: true, gender: true, civilStatus: true,
  nationality: true, address: true, tin: true, sssNo: true, philHealthNo: true, pagIbigNo: true,
} as const satisfies Prisma.EmployeeSelect;

type EmployeeOverviewQueryResult = Prisma.EmployeeGetPayload<{ select: typeof employeeOverviewSelect }>;
type EmployeeEditQueryResult = Prisma.EmployeeGetPayload<{ select: typeof employeeEditSelect }>;

export function serializeEmployeeOverview(employee: EmployeeOverviewQueryResult) {
  return {
    id: employee.id.toString(), employeeId: employee.employeeId, fullName: getEmployeeFullName(employee),
    emailAddress: employee.emailAddress, contactNumber: employee.contactNumber,
    role: employee.role, status: employee.status, dateStarted: formatDateInput(employee.dateStarted),
  };
}
export type EmployeeOverview = ReturnType<typeof serializeEmployeeOverview>;

export function serializeEmployeeForEdit(employee: EmployeeEditQueryResult) {
  const values = Object.fromEntries(employeeFields.map((field) => {
    const value = employee[field];
    return [field, value instanceof Date ? formatDateInput(value) : value ?? ""];
  })) as EmployeeFormValues;
  return { id: employee.id.toString(), values, fullName: getEmployeeFullName(employee) };
}
