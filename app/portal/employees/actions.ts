"use server";

import { createEmployee, updateEmployee } from "@/lib/employees/admin";
import type { EmployeeFormState } from "@/lib/employees/validation";

export async function createEmployeeAction(previousState: EmployeeFormState, formData: FormData) {
  return createEmployee(previousState, formData);
}

export async function updateEmployeeAction(previousState: EmployeeFormState, formData: FormData) {
  return updateEmployee(previousState, formData);
}
