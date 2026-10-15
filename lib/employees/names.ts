type EmployeeName = {
  firstName: string | null;
  middleName?: string | null;
  lastName: string | null;
  suffix?: string | null;
};

export function getEmployeeFullName(employee: EmployeeName): string {
  const fullName = [employee.firstName, employee.middleName, employee.lastName, employee.suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || "Name not set";
}
