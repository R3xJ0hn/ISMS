import { requireSuperAdmin } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { literalInsensitiveEquality, normalizeEmail } from "@/lib/utils";
import { cleanupProfileImage, parseProfileImageInput, prepareProfileImage } from "@/lib/users/profile-image";
import { getUserForProfile, ProfileIdentityError, type UserIdentity } from "@/lib/users/profiles";
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
  if (error instanceof ProfileIdentityError) {
    return { success: false, message: "Unable to link this profile photo to an account. Check the employee's account details and try again.",
      fieldErrors: { image: "The employee's account details need to be checked before changing the photo." } };
  }
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

async function validateEmployeeSave(
  transaction: Prisma.TransactionClient, data: EmployeeWriteData, superAdminEmail: string, id?: bigint,
): Promise<EmployeeFormState | null> {
  if (id !== undefined) {
    const employee = await transaction.employee.findUnique({ where: { id, ...visibleEmployeeWhere(superAdminEmail) }, select: { id: true } });
    if (!employee) return missingEmployeeError();
  }
  return await restrictedEmailError(transaction, data.emailAddress) ?? await duplicateEmployeeError(transaction, data, id);
}

async function saveEmployee(formData: FormData, mode: "create" | "edit"): Promise<EmployeeFormState> {
  const superAdmin = await requireSuperAdmin();
  const parsed = parseEmployeeForm(formData, mode);
  if (!parsed.success) return parsed;
  const id = parsed.id;
  if (mode === "edit" && id === undefined) return missingEmployeeError();
  const imageInput = parseProfileImageInput(formData);
  if (!imageInput.success) return imageInput;
  let expectedUser: UserIdentity | null = null;
  let expectedImage: string | null = null;
  // Check record visibility, duplicates, and the original account identity before an external upload.
  if (imageInput.file || imageInput.remove) {
    try {
      const failure = await prisma.$transaction(async (transaction) => {
        const invalid = await validateEmployeeSave(transaction, parsed.data, superAdmin.email, id);
        if (!invalid && id !== undefined) {
          expectedUser = await getUserForProfile(transaction, { kind: "employee", id });
          expectedImage = (await transaction.employee.findUnique({ where: { id }, select: { userImage: true } }))?.userImage ?? null;
        }
        return invalid;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (failure) return failure;
    } catch (error) { return saveEmployeeError(error); }
  }
  const prepared = await prepareProfileImage(formData, `employee:${id?.toString() ?? randomUUID()}`);
  if (!prepared.success) return prepared;
  const imageChange = prepared.change;
  let result: EmployeeFormState;
  try {
    result = await prisma.$transaction(async (transaction): Promise<EmployeeFormState> => {
      const invalid = await validateEmployeeSave(transaction, parsed.data, superAdmin.email, id);
      if (invalid) return invalid;
      // Resolve before editing the employee's email so a new address cannot redirect the photo to someone else.
      let linkedUser = imageChange && id !== undefined
        ? await getUserForProfile(transaction, { kind: "employee", id }) : null;
      if (imageChange && id !== undefined) {
        const currentImage = (await transaction.employee.findUnique({ where: { id }, select: { userImage: true } }))?.userImage ?? null;
        if (linkedUser?.id !== expectedUser?.id || linkedUser?.email !== expectedUser?.email ||
          linkedUser?.role !== expectedUser?.role || linkedUser?.userImage !== expectedUser?.userImage || currentImage !== expectedImage) {
          throw new ProfileIdentityError();
        }
      }
      const data = { ...parsed.data, ...(imageChange ? { userImage: imageChange.value } : {}) };
      const employee = id === undefined
        ? await transaction.employee.create({ data, select: { id: true } })
        : await transaction.employee.update({ where: { id }, data, select: { id: true } });
      if (imageChange && id === undefined) linkedUser = await getUserForProfile(transaction, { kind: "employee", id: employee.id });
      if (imageChange && linkedUser) {
        const saved = await transaction.user.updateMany({
          where: { id: linkedUser.id, role: { equals: linkedUser.role, not: "superAdmin" }, email: literalInsensitiveEquality(linkedUser.email) },
          data: { userImage: imageChange.value },
        });
        if (saved.count !== 1) throw new ProfileIdentityError();
      }
      return { success: true, message: mode === "create" ? "Employee added successfully." : "Employee updated successfully." };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    await cleanupProfileImage(imageChange);
    return saveEmployeeError(error);
  }
  if (result.success) {
    revalidatePath("/portal/employees");
    if (id !== undefined) revalidatePath(`/portal/employees/${id}/edit`);
    revalidatePath("/portal/users");
    if (imageChange) revalidatePath("/portal", "layout");
  } else await cleanupProfileImage(imageChange);
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
  if (!employee) return null;
  const result = serializeEmployeeForEdit(employee);
  if (result.userImage === null) {
    try { result.userImage = (await getUserForProfile(prisma, { kind: "employee", id }))?.userImage ?? null; }
    catch (error) {
      if (!(error instanceof ProfileIdentityError)) throw error;
      // Ambiguous associations must not reveal another person's account photo.
    }
  }
  return result;
}
