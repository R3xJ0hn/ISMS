import { requireSuperAdmin } from "@/lib/auth";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { employeeEditSelect, employeeOverviewSelect, serializeEmployeeForEdit, serializeEmployeeOverview } from "./records";
import { parseEmployeeForm, parseEmployeeRecordId, type EmployeeFormState, type EmployeeWriteData } from "./validation";

export type { EmployeeOverview } from "./records";

function missingEmployeeError(): EmployeeFormState {
  return {
    success: false, message: "This employee record no longer exists.",
    fieldErrors: { employeeRecordId: "Choose an existing employee record." },
  };
}

function visibleEmployeeWhere(superAdminEmail: string) {
  return {
    NOT: { emailAddress: literalInsensitiveEquality(normalizeEmail(superAdminEmail)) },
  };
}

async function restrictedEmailError(transaction: Prisma.TransactionClient, emailAddress: string): Promise<EmployeeFormState | null> {
  const account = await transaction.user.findFirst({
    where: { role: "superAdmin", email: literalInsensitiveEquality(emailAddress) },
    select: { id: true },
  });
  return account ? {
    success: false, message: "Choose a different email address.",
    fieldErrors: { emailAddress: "Choose a different email address." },
  } : null;
}

async function duplicateEmployeeError(
  transaction: Prisma.TransactionClient, data: EmployeeWriteData, employeeRecordId?: bigint,
): Promise<EmployeeFormState | null> {
  const exclusion = employeeRecordId === undefined ? {} : { id: { not: employeeRecordId } };
  const [duplicateId, duplicateEmail] = await Promise.all([
    transaction.employee.findFirst({ where: { ...exclusion, employeeId: literalInsensitiveEquality(data.employeeId) }, select: { id: true } }),
    transaction.employee.findFirst({ where: { ...exclusion, emailAddress: literalInsensitiveEquality(data.emailAddress) }, select: { id: true } }),
  ]);
  if (!duplicateId && !duplicateEmail) return null;
  return {
    success: false, message: "An employee already uses this employee ID or email address.",
    fieldErrors: {
      ...(duplicateId ? { employeeId: "Choose an employee ID that is not already in use." } : {}),
      ...(duplicateEmail ? { emailAddress: "Choose an email address that is not already in use." } : {}),
    },
  };
}

function saveEmployeeError(error: unknown): EmployeeFormState {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [String(error.meta?.target ?? "")];
      return {
        success: false, message: "An employee already uses this employee ID or email address.",
        fieldErrors: {
          ...(targets.some((target) => target.includes("employee_id") || target.includes("employeeId"))
            ? { employeeId: "Choose an employee ID that is not already in use." } : {}),
          ...(targets.some((target) => target.includes("email_address") || target.includes("emailAddress"))
            ? { emailAddress: "Choose an email address that is not already in use." } : {}),
        },
      };
    }
    if (error.code === "P2025") return missingEmployeeError();
    if (error.code === "P2034") return { success: false, message: "Employees changed while saving. Please try again." };
  }
  console.error("Failed to save employee record.");
  return { success: false, message: "Unable to save the employee record. Please try again." };
}

async function saveEmployee(formData: FormData, mode: "create" | "edit"): Promise<EmployeeFormState> {
  const superAdmin = await requireSuperAdmin();
  const parsed = parseEmployeeForm(formData, mode);
  if (!parsed.success) return parsed;
  const id = parsed.id;
  if (mode === "edit" && id === undefined) return missingEmployeeError();
  let result: EmployeeFormState;
  try {
    result = await prisma.$transaction(async (transaction): Promise<EmployeeFormState> => {
      if (id !== undefined) {
        const employee = await transaction.employee.findUnique({ where: { id, ...visibleEmployeeWhere(superAdmin.email) }, select: { id: true } });
        if (!employee) return missingEmployeeError();
      }
      const restrictedEmail = await restrictedEmailError(transaction, parsed.data.emailAddress);
      if (restrictedEmail) return restrictedEmail;
      const duplicate = await duplicateEmployeeError(transaction, parsed.data, id);
      if (duplicate) return duplicate;
      if (id === undefined) await transaction.employee.create({ data: parsed.data, select: { id: true } });
      else await transaction.employee.update({ where: { id }, data: parsed.data, select: { id: true } });
      return { success: true, message: mode === "create" ? "Employee added successfully." : "Employee updated successfully." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    return saveEmployeeError(error);
  }
  if (result.success) {
    revalidatePath("/portal/employees");
    if (id !== undefined) revalidatePath(`/portal/employees/${id}/edit`);
  }
  return result;
}

export async function createEmployee(_previousState: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  return saveEmployee(formData, "create");
}

export async function updateEmployee(_previousState: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  return saveEmployee(formData, "edit");
}

export async function getEmployees() {
  const superAdmin = await requireSuperAdmin();
  const employees = await prisma.employee.findMany({ where: visibleEmployeeWhere(superAdmin.email), orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }], select: employeeOverviewSelect });
  return employees.map(serializeEmployeeOverview);
}

export async function getEmployeeForEdit(recordId: string) {
  const superAdmin = await requireSuperAdmin();
  const id = parseEmployeeRecordId(recordId);
  if (id === null) return null;
  const employee = await prisma.employee.findUnique({ where: { id, ...visibleEmployeeWhere(superAdmin.email) }, select: employeeEditSelect });
  return employee ? serializeEmployeeForEdit(employee) : null;
}
