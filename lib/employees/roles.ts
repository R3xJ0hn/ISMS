import { EmployeeRole } from "@/lib/generated/prisma/enums";

export const employeeRoleOptions = [
  { value: EmployeeRole.admin, label: "Admin" },
  { value: EmployeeRole.registrar, label: "Registrar" },
  { value: EmployeeRole.teacher, label: "Teacher" },
  { value: EmployeeRole.nonTeaching, label: "Non-teaching" },
] as const;

export function isEmployeeRole(value: string): value is EmployeeRole {
  return employeeRoleOptions.some((option) => option.value === value);
}

export function formatEmployeeRoleLabel(role: EmployeeRole) {
  return employeeRoleOptions.find((option) => option.value === role)?.label ?? "";
}
