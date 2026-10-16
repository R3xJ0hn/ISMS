import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as employeeValidation from "../lib/employees/validation";
import * as employeeRecords from "../lib/employees/records";
import type * as employeeServices from "../lib/employees/admin";
import { literalInsensitiveEquality } from "../lib/utils";
import type { UserIdentity } from "../lib/users/profiles";

type Employee = employeeValidation.EmployeeWriteData & { id: bigint; userImage?: string | null };
type Query = {
  where?: {
    id?: bigint | { not: bigint };
    employeeId?: { equals: string; mode: string };
    emailAddress?: { equals: string; mode: string };
    email?: { equals: string; mode: string };
    role?: string | { equals: string; not: string };
    NOT?: { emailAddress: { equals: string; mode: string } };
  };
  data?: Partial<employeeValidation.EmployeeWriteData> & { userImage?: string | null };
  select?: Record<string, boolean>;
  orderBy?: Array<Record<string, string>>;
};
type Call = { method: string; query: Query };
class DatabaseError extends Error {
  constructor(public code: string, public meta?: { target?: string | string[] }) { super("Sensitive database details should not escape"); }
}
class ProfileIdentityError extends Error {}

const code = ts.transpileModule(readFileSync(new URL("../lib/employees/admin.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;
const state = { success: false, message: "" };
const savedEmployee: Employee = {
  id: 9007199254740993n, employeeId: "emp-000a", firstName: "Maria", lastName: "McDonald", middleName: null, suffix: null,
  birthDate: new Date("1990-02-28T00:00:00Z"),
  placeOfBirth: "Quezon City", gender: "Female", civilStatus: "Single", nationality: "Filipino", address: "Main Street",
  contactNumber: "09171234567", emailAddress: "maria@example.com", tin: "001-123", sssNo: null, philHealthNo: "000100",
  pagIbigNo: null, dateStarted: new Date("2020-03-01T00:00:00Z"), role: "teacher", status: "Regular",
};

function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [field, value] of Object.entries({
    employeeRecordId: savedEmployee.id.toString(), employeeId: "emp-000a", firstName: " <b>maria</b> ", lastName: " McDonald ", middleName: "", suffix: "",
    birthDate: "1990-02-28", placeOfBirth: " quezon city ", gender: "Female", civilStatus: "Single", nationality: "filipino",
    address: "main street", contactNumber: "09171234567", emailAddress: " MARIA@Example.COM ", tin: "001-123",
    sssNo: "", philHealthNo: "000100", pagIbigNo: "", dateStarted: "2020-03-01", role: "teacher", status: "Regular", ...overrides,
  })) result.set(field, value);
  return result;
}

function matchesInsensitivePattern(value: string, pattern: string) {
  let expression = "";
  for (let index = 0; index < pattern.length; index++) {
    let character = pattern[index];
    if (character === "\\") {
      character = pattern[++index];
      if (character === undefined) throw new Error("Invalid ILIKE escape");
    } else if (character === "%") { expression += ".*"; continue; }
    else if (character === "_") { expression += "."; continue; }
    expression += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + expression + "$", "isu").test(value);
}

function harness(options: {
  denied?: boolean; employees?: Employee[]; writeError?: string; target?: string | string[]; unknownError?: boolean; superAdminEmail?: string;
  linkedUser?: UserIdentity | null; identityError?: boolean; userWriteCount?: number; imageError?: boolean;
} = {}) {
  const employees = structuredClone(options.employees ?? []);
  const superAdminEmail = options.superAdminEmail ?? "root_user@example.com";
  const calls: Call[] = [];
  const events: string[] = [];
  const revalidated: string[] = [];
  const logs: unknown[][] = [];
  const profileLookups: Array<{ id: bigint; email: string | undefined }> = [];
  const cleaned: unknown[] = [];
  function record(method: string, query: Query) {
    calls.push({ method, query: structuredClone(query) });
    events.push(method);
  }
  function matches(employee: Employee, query: Query) {
    const { id, employeeId, emailAddress, NOT } = query.where ?? {};
    return (typeof id === "bigint" ? employee.id === id : !id || employee.id !== id.not) &&
      (!employeeId || matchesInsensitivePattern(employee.employeeId, employeeId.equals)) &&
      (!emailAddress || matchesInsensitivePattern(employee.emailAddress, emailAddress.equals)) &&
      (!NOT || !matchesInsensitivePattern(employee.emailAddress, NOT.emailAddress.equals));
  }
  function throwWriteError() {
    if (options.unknownError) throw new Error("Sensitive submitted employee details");
    if (options.writeError) throw new DatabaseError(options.writeError, { target: options.target });
  }
  const employee = {
    findFirst: async (query: Query) => { record("findFirst", query); return structuredClone(employees.find((row) => matches(row, query)) ?? null); },
    findUnique: async (query: Query) => { record("findUnique", query); return structuredClone(employees.find((row) => matches(row, query)) ?? null); },
    // Return full rows deliberately: serialization must still protect overview privacy.
    findMany: async (query: Query) => { record("findMany", query); return structuredClone(employees.filter((row) => matches(row, query))); },
    create: async (query: Query) => {
      record("create", query); throwWriteError();
      const created = { id: 8n, ...query.data } as Employee;
      employees.push(created); return { id: created.id };
    },
    update: async (query: Query) => {
      record("update", query); throwWriteError();
      const existing = employees.find((row) => matches(row, query));
      if (!existing) throw new DatabaseError("P2025");
      Object.assign(existing, query.data); return { id: existing.id };
    },
  };
  const user = {
    findFirst: async (query: Query) => {
      record("userFindFirst", query);
      assert.equal(query.where?.role, "superAdmin");
      assert.deepEqual(structuredClone(query.select), { id: true });
      return query.where?.email && matchesInsensitivePattern(superAdminEmail, query.where.email.equals) ? { id: 1n } : null;
    },
    updateMany: async (query: Query) => { record("userUpdateMany", query); return { count: options.userWriteCount ?? 1 }; },
  };
  function imageInput(data: FormData) {
    const image = data.get("image");
    if (image !== null && !(image instanceof File)) return { success: false, message: "Choose an image file.", fieldErrors: { image: "Choose an image file." } };
    return { success: true, file: image instanceof File && image.size ? image : undefined, remove: data.get("removeImage") === "true" };
  }
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSuperAdmin: async () => {
      events.push("authorize"); if (options.denied) throw new Error("Access denied");
      return { id: "1", email: superAdminEmail, role: "superAdmin", emailVerified: true, sessionVersion: 0 };
    } },
    "@/lib/generated/prisma/client": { Prisma: { PrismaClientKnownRequestError: DatabaseError, TransactionIsolationLevel: { Serializable: "Serializable" } } },
    "@/lib/prisma": { prisma: { employee, $transaction: async (
      callback: (transaction: { employee: typeof employee; user: typeof user }) => Promise<unknown>, transactionOptions: { isolationLevel: string },
    ) => {
      events.push("transaction"); assert.equal(transactionOptions.isolationLevel, "Serializable");
      const before = structuredClone(employees);
      try { return await callback({ employee, user }); }
      catch (error) { employees.splice(0, employees.length, ...before); throw error; }
    } } },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "@/lib/utils": { literalInsensitiveEquality, normalizeEmail: (value: string) => value.trim().toLowerCase() },
    "node:crypto": { randomUUID: () => "unpredictable-new-profile-id" },
    "@/lib/users/profiles": {
      ProfileIdentityError,
      getUserForProfile: async (_transaction: unknown, reference: { kind: string; id: bigint }) => {
        assert.equal(reference.kind, "employee");
        profileLookups.push({ id: reference.id, email: employees.find((row) => row.id === reference.id)?.emailAddress });
        if (options.identityError) throw new ProfileIdentityError();
        return options.linkedUser ?? null;
      },
    },
    "@/lib/users/profile-image": {
      parseProfileImageInput: imageInput,
      prepareProfileImage: async (data: FormData, scope: string) => {
        const input = imageInput(data);
        if (!input.success) return input;
        if (input.file) {
          events.push("upload");
          assert.match(scope, /^employee:/);
          assert.doesNotMatch(scope, /maria|@/);
          return options.imageError ? { success: false, message: "Upload unavailable.", fieldErrors: { image: "Upload unavailable." } }
            : { success: true, change: { value: "https://res.cloudinary.com/demo/image/upload/employee-photo.png", upload: { secureUrl: "https://res.cloudinary.com/demo/image/upload/employee-photo.png", publicId: "employee-photo", scope } } };
        }
        return { success: true, ...(input.remove ? { change: { value: null } } : {}) };
      },
      cleanupProfileImage: async (change: unknown) => { cleaned.push(change); },
    },
    "./records": employeeRecords,
    "./validation": { ...employeeValidation, parseEmployeeForm: (...args: Parameters<typeof employeeValidation.parseEmployeeForm>) => {
      events.push("parse"); return employeeValidation.parseEmployeeForm(...args);
    } },
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports, console: { error: (...args: unknown[]) => logs.push(args) },
    require: (name: string) => { assert.ok(name in modules, `Unexpected employee dependency ${name}`); return modules[name]; },
  });
  return { services: loaded.exports as typeof employeeServices, calls, events, revalidated, employees, logs, profileLookups, cleaned };
}

test("employee actions and reads authorize superadmin before parsing or database access", async () => {
  for (const method of ["createEmployee", "updateEmployee"] as const) {
    const service = harness({ denied: true });
    await assert.rejects(service.services[method](state, new FormData()), /Access denied/);
    assert.deepEqual(service.events, ["authorize"]);
    assert.equal(service.calls.length, 0);
  }
  for (const method of ["getEmployees", "getEmployeeForEdit"] as const) {
    const service = harness({ denied: true });
    await assert.rejects(service.services[method]("invalid"), /Access denied/);
    assert.deepEqual(service.events, ["authorize"]);
    assert.equal(service.calls.length, 0);
  }
});

test("employee creation saves normalized whitelisted fields without creating a portal account", async () => {
  const service = harness();
  const result = await service.services.createEmployee(state, form({ password: "injected", passwordHash: "injected", emailVerified: "true", userId: "123" }));
  assert.equal(result.success, true);
  const created = service.calls.find((call) => call.method === "create")?.query.data;
  assert.equal(created?.firstName, "Maria");
  assert.equal(created?.lastName, "McDonald");
  assert.equal(created?.middleName, null);
  assert.equal(created?.suffix, null);
  assert.equal(created?.employeeId, "emp-000a");
  assert.equal(created?.emailAddress, "maria@example.com");
  assert.equal(created?.tin, "001-123");
  assert.equal(created?.sssNo, null);
  assert.equal(created?.philHealthNo, "000100");
  assert.equal(created?.role, "teacher");
  assert.equal(created?.status, "Regular");
  assert.deepEqual(Object.keys(created ?? {}), [...employeeValidation.employeeFields]);
  assert.deepEqual(service.events.slice(0, 3), ["authorize", "parse", "transaction"]);
  assert.deepEqual(service.revalidated, ["/portal/employees", "/portal/users"]);
  assert.equal("password" in result || "passwordHash" in result, false);
});

test("employee edits use the internal record ID and can change the business code and profile role", async () => {
  const service = harness({ employees: [savedEmployee] });
  const result = await service.services.updateEmployee(state, form({ employeeId: "newCode-000b", firstName: " maria elena ", lastName: " santos ", middleName: "<b>reyes</b>", suffix: " jr. ", role: "nonTeaching", status: "Contractual" }));
  assert.equal(result.success, true);
  const updated = service.calls.find((call) => call.method === "update")?.query;
  assert.equal(updated?.where?.id, savedEmployee.id);
  assert.equal(updated?.data?.employeeId, "newCode-000b");
  assert.equal(updated?.data?.firstName, "Maria Elena");
  assert.equal(updated?.data?.lastName, "Santos");
  assert.equal(updated?.data?.middleName, "Reyes");
  assert.equal(updated?.data?.suffix, "Jr.");
  assert.equal(updated?.data?.role, "nonTeaching");
  assert.equal(updated?.data?.status, "Contractual");
  assert.equal("id" in (updated?.data ?? {}), false);
  const duplicateChecks = service.calls.filter((call) => call.method === "findFirst");
  assert.equal(duplicateChecks.length, 2);
  for (const call of duplicateChecks) assert.deepEqual(call.query.where?.id, { not: savedEmployee.id });
  assert.deepEqual(service.revalidated, ["/portal/employees", `/portal/employees/${savedEmployee.id}/edit`, "/portal/users"]);
});

test("employee actions reject forged student and superadmin roles before database access", async () => {
  for (const role of ["student", "superAdmin"]) {
    for (const method of ["createEmployee", "updateEmployee"] as const) {
      const service = harness({ employees: [savedEmployee] });
      const result = await service.services[method](state, form({ role }));
      assert.equal(result.success, false);
      assert.ok(result.fieldErrors?.role);
      assert.deepEqual(service.events, ["authorize", "parse"]);
      assert.equal(service.calls.length, 0);
      assert.equal(service.revalidated.length, 0);
      assert.deepEqual(service.employees, [savedEmployee]);
    }
  }
});

test("employee records cannot use the protected account email and the response reveals no account details", async () => {
  for (const method of ["createEmployee", "updateEmployee"] as const) {
    const service = harness({ employees: [savedEmployee], superAdminEmail: "Root_User@Example.com" });
    const result = await service.services[method](state, form({ emailAddress: " ROOT_USER@EXAMPLE.COM " }));
    assert.equal(result.success, false);
    assert.equal(result.fieldErrors?.emailAddress, "Choose a different email address.");
    assert.equal(service.calls.some((call) => call.method === "create" || call.method === "update"), false);
    assert.equal(service.revalidated.length, 0);
    assert.deepEqual(service.employees, [savedEmployee]);
    assert.doesNotMatch(JSON.stringify(result), /root_user|superadmin/i);
  }
  const literalEmail = harness({ superAdminEmail: "root_user@example.com" });
  assert.equal((await literalEmail.services.createEmployee(state, form({ emailAddress: "rootAuser@example.com" }))).success, true);
});

test("protected account profiles are omitted from employee lists and unavailable to guessed edit requests", async () => {
  const hidden = { ...savedEmployee, id: 2n, employeeId: "internal-code", emailAddress: "ROOT_USER@Example.com" };
  const service = harness({ employees: [savedEmployee, hidden], superAdminEmail: "root_user@example.com" });
  const employees = await service.services.getEmployees();
  assert.deepEqual(employees.map((employee) => employee.id), [savedEmployee.id.toString()]);
  assert.equal(await service.services.getEmployeeForEdit(hidden.id.toString()), null);
  const edited = await service.services.updateEmployee(state, form({ employeeRecordId: hidden.id.toString(), emailAddress: "another@example.com" }));
  assert.equal(edited.success, false);
  assert.ok(edited.fieldErrors?.employeeRecordId);
  assert.equal(service.calls.some((call) => call.method === "update"), false);
  assert.equal(service.revalidated.length, 0);
  assert.deepEqual(service.employees, [savedEmployee, hidden]);
});

test("employee ID and email duplicates are case insensitive and receive separate field errors", async () => {
  for (const method of ["createEmployee", "updateEmployee"] as const) {
    const service = harness({ employees: [
      ...(method === "updateEmployee" ? [{ ...savedEmployee, employeeId: "other", emailAddress: "other@example.com" }] : []),
      { ...savedEmployee, id: 2n, employeeId: "EMP-000A", emailAddress: "another@example.com" },
      { ...savedEmployee, id: 3n, employeeId: "another", emailAddress: "MARIA@EXAMPLE.COM" },
    ] });
    const result = await service.services[method](state, form());
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.employeeId);
    assert.ok(result.fieldErrors?.emailAddress);
    assert.equal(service.calls.some((call) => call.method === "create" || call.method === "update"), false);
    assert.equal(service.revalidated.length, 0);
    for (const call of service.calls.filter((call) => call.method === "findFirst")) {
      assert.equal(call.query.where?.employeeId?.mode ?? call.query.where?.emailAddress?.mode, "insensitive");
    }
  }
});

test("employee duplicate checks treat underscores, percent signs and backslashes as literal text", async () => {
  const distinctValues = {
    employeeId: [
      ["EMP_001", "EMP-001"], ["EMP%001", "EMP-extra-001"], ["EMP\\_001", "EMP_001"],
      ["EMP\\%001", "EMP%001"], ["EMP\\", "EMP"],
    ],
    emailAddress: [
      ["maria_smith@example.com", "maria-smith@example.com"],
      ["maria%smith@example.com", "maria-anything-smith@example.com"],
      ["maria\\_smith@example.com", "maria_smith@example.com"],
      ["maria\\%smith@example.com", "maria%smith@example.com"],
    ],
  } as const;
  for (const field of ["employeeId", "emailAddress"] as const) {
    for (const [submitted, existing] of distinctValues[field]) {
      for (const method of ["createEmployee", "updateEmployee"] as const) {
        const service = harness({ employees: [
          ...(method === "updateEmployee" ? [{ ...savedEmployee, employeeId: "edited-record", emailAddress: "edited@example.com" }] : []),
          { ...savedEmployee, id: 2n, [field]: existing },
        ] });
        const result = await service.services[method](state, form({ employeeId: "fresh-record", emailAddress: "fresh@example.com", [field]: submitted }));
        assert.equal(result.success, true, `${method}/${field}/${submitted}/${existing}`);
        const saved = service.calls.find((call) => call.method === "create" || call.method === "update")?.query.data;
        assert.equal(saved?.[field], submitted, "Escaping must not alter the stored value");
      }
    }
  }
});

test("literal punctuation duplicates remain case insensitive and report the correct field", async () => {
  const duplicateValues = {
    employeeId: ["emp_001", "emp%001", "emp\\_001", "emp\\%001", "emp\\"],
    emailAddress: ["maria_smith@example.com", "maria%smith@example.com", "maria\\_smith@example.com", "maria\\%smith@example.com"],
  } as const;
  for (const field of ["employeeId", "emailAddress"] as const) {
    for (const submitted of duplicateValues[field]) {
      for (const method of ["createEmployee", "updateEmployee"] as const) {
        const service = harness({ employees: [
          ...(method === "updateEmployee" ? [{ ...savedEmployee, employeeId: "edited-record", emailAddress: "edited@example.com" }] : []),
          { ...savedEmployee, id: 2n, [field]: submitted.toUpperCase() },
        ] });
        const result = await service.services[method](state, form({ employeeId: "fresh-record", emailAddress: "fresh@example.com", [field]: submitted }));
        assert.equal(result.success, false, `${method}/${field}/${submitted}`);
        assert.ok(result.fieldErrors?.[field]);
        assert.equal(Boolean(result.fieldErrors?.[field === "employeeId" ? "emailAddress" : "employeeId"]), false);
        assert.equal(service.calls.some((call) => call.method === "create" || call.method === "update"), false);
      }
    }
  }
});

test("unchanged business IDs and emails exclude the edited employee from duplicate detection", async () => {
  const service = harness({ employees: [{ ...savedEmployee, emailAddress: "Maria@Example.com", employeeId: "EMP-000A" }] });
  assert.equal((await service.services.updateEmployee(state, form())).success, true);
});

test("invalid inputs and missing employee records do not write or revalidate", async () => {
  for (const method of ["createEmployee", "updateEmployee"] as const) {
    const invalid = harness();
    const result = await invalid.services[method](state, form({ firstName: "<br>", employeeRecordId: "invalid" }));
    assert.equal(result.success, false);
    assert.equal(invalid.calls.length, 0);
    assert.equal(invalid.revalidated.length, 0);
  }
  const missing = harness();
  const result = await missing.services.updateEmployee(state, form());
  assert.equal(result.success, false);
  assert.ok(result.fieldErrors?.employeeRecordId);
  assert.equal(missing.calls.length, 1);
  assert.equal(missing.revalidated.length, 0);
});

test("unique-constraint races, disappearance and transaction conflicts return safe actionable errors", async () => {
  for (const [writeError, target, field] of [
    ["P2002", ["employee_id"], "employeeId"], ["P2002", "employees_email_address_key", "emailAddress"],
    ["P2025", undefined, "employeeRecordId"], ["P2034", undefined, undefined],
  ] as const) {
    const service = harness({ employees: [savedEmployee], writeError, target: target ? [...(typeof target === "string" ? [target] : target)] : undefined });
    const result = await service.services.updateEmployee(state, form({ firstName: "updated name" }));
    assert.equal(result.success, false);
    if (field) assert.ok(result.fieldErrors?.[field]);
    else assert.match(result.message, /try again/i);
    assert.equal(service.revalidated.length, 0);
    assert.equal(service.employees[0].firstName, savedEmployee.firstName);
    assert.doesNotMatch(JSON.stringify(result), /Sensitive/);
  }
});

test("unknown employee save failures never log raw errors or personal details", async () => {
  const service = harness({ unknownError: true });
  const result = await service.services.createEmployee(state, form());
  assert.equal(result.success, false);
  assert.equal(service.logs.length, 1);
  assert.deepEqual(service.logs[0], ["Failed to save employee record."]);
  assert.doesNotMatch(JSON.stringify({ result, logs: service.logs }), /maria|001-123|Sensitive/i);
});

test("employee overview queries and serialization exclude birth dates, addresses and government identifiers", async () => {
  const service = harness({ employees: [savedEmployee] });
  const employees = await service.services.getEmployees();
  assert.deepEqual(service.calls[0].query.select, employeeRecords.employeeOverviewSelect);
  assert.deepEqual(service.calls[0].query.orderBy, [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }]);
  assert.equal("fullName" in (service.calls[0].query.select ?? {}), false);
  assert.deepEqual(employees[0], {
    id: savedEmployee.id.toString(), employeeId: "emp-000a", fullName: "Maria McDonald", emailAddress: "maria@example.com",
    contactNumber: "09171234567", role: "teacher", status: "Regular", dateStarted: "2020-03-01",
  });
  assert.equal("birthDate" in employees[0] || "address" in employees[0] || "tin" in employees[0], false);
  assert.doesNotThrow(() => JSON.stringify(employees));
});

test("employee edit reads serialize date-only and nullable fields without losing bigint IDs", async () => {
  const service = harness({ employees: [savedEmployee] });
  const result = await service.services.getEmployeeForEdit(savedEmployee.id.toString());
  assert.equal(result?.id, savedEmployee.id.toString());
  assert.equal(result?.values.employeeId, "emp-000a");
  assert.equal(result?.values.firstName, "Maria");
  assert.equal(result?.values.lastName, "McDonald");
  assert.equal(result?.values.middleName, "");
  assert.equal(result?.values.suffix, "");
  assert.equal(result?.values.birthDate, "1990-02-28");
  assert.equal(result?.values.dateStarted, "2020-03-01");
  assert.equal(result?.values.sssNo, "");
  assert.equal(result?.values.pagIbigNo, "");
  assert.equal(result?.values.philHealthNo, "000100");
  assert.deepEqual(Object.keys(result?.values ?? {}), [...employeeValidation.employeeFields]);
  assert.deepEqual(service.calls[0].query.select, employeeRecords.employeeEditSelect);
  assert.doesNotThrow(() => JSON.stringify(result));
  const invalid = harness();
  assert.equal(await invalid.services.getEmployeeForEdit("emp-000a"), null);
  assert.deepEqual(invalid.events, ["authorize"]);
  assert.equal(invalid.calls.length, 0);
  assert.equal(await invalid.services.getEmployeeForEdit("1"), null);
});

test("employee records without names remain editable and require separate first and last names on save", async () => {
  const unnamedEmployee = {
    ...savedEmployee, firstName: null, lastName: null, middleName: null, suffix: null,
  };
  const service = harness({ employees: [unnamedEmployee] });
  assert.equal((await service.services.getEmployees())[0].fullName, "Name not set");
  const edit = await service.services.getEmployeeForEdit(savedEmployee.id.toString());
  assert.equal(edit?.fullName, "Name not set");
  assert.equal(edit?.values.firstName, "");
  assert.equal(edit?.values.lastName, "");

  const invalid = await service.services.updateEmployee(state, form({ firstName: "", lastName: "", fullName: "Forged name" }));
  assert.equal(invalid.success, false);
  assert.ok(invalid.fieldErrors?.firstName);
  assert.ok(invalid.fieldErrors?.lastName);
  assert.equal(service.employees[0].firstName, null);
  assert.equal(service.employees[0].lastName, null);
  assert.equal(service.calls.some((call) => call.method === "update"), false);

  const saved = await service.services.updateEmployee(state, form({ firstName: "maria", lastName: "de la cruz", middleName: "", suffix: "", fullName: "Forged name" }));
  assert.equal(saved.success, true);
  assert.equal(service.employees[0].firstName, "Maria");
  assert.equal(service.employees[0].lastName, "De La Cruz");
  assert.equal("fullName" in (service.calls.find((call) => call.method === "update")?.query.data ?? {}), false);
  assert.equal((await service.services.getEmployees())[0].fullName, "Maria De La Cruz");
});

test("employee photos can be added before account creation and blank edits preserve them", async () => {
  const h = harness(), data = form(); data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
  assert.equal((await h.services.createEmployee(state, data)).success, true);
  assert.equal(h.employees[0].userImage, "https://res.cloudinary.com/demo/image/upload/employee-photo.png");
  assert.equal(h.calls.some((call) => call.method.startsWith("userUpdate")), false);
  const edit = form({ employeeRecordId: h.employees[0].id.toString() });
  assert.equal((await h.services.updateEmployee(state, edit)).success, true);
  assert.equal(h.employees[0].userImage, "https://res.cloudinary.com/demo/image/upload/employee-photo.png");
});

test("employee photo replacements and removals sync only the original linked account even when editing employee email", async () => {
  const linkedUser: UserIdentity = { id: 55n, email: savedEmployee.emailAddress, role: "teacher", userImage: "https://old.example/photo.png" };
  const h = harness({ employees: [savedEmployee], linkedUser }), data = form({ emailAddress: "new@example.test" });
  data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
  assert.equal((await h.services.updateEmployee(state, data)).success, true);
  const write = h.calls.find((call) => call.method === "userUpdateMany")!;
  assert.equal(write.query.where?.id, linkedUser.id);
  assert.deepEqual(Object.keys(write.query.data!), ["userImage"]);
  assert.ok(h.profileLookups.every((lookup) => lookup.email === savedEmployee.emailAddress));
  assert.equal(h.employees[0].userImage, write.query.data?.userImage);
  const removal = harness({ employees: [{ ...savedEmployee, userImage: linkedUser.userImage }], linkedUser }), remove = form(); remove.set("removeImage", "true");
  assert.equal((await removal.services.updateEmployee(state, remove)).success, true);
  assert.equal(removal.employees[0].userImage, null);
  assert.equal(removal.calls.find((call) => call.method === "userUpdateMany")?.query.data?.userImage, null);
});

test("employee photo failures preserve the profile and reject missing or hidden targets before upload", async () => {
  const data = form(); data.set("image", new File(["synthetic"], "photo.png", { type: "image/png" }));
  for (const options of [{ imageError: true }, { userWriteCount: 0 }]) {
    const h = harness({ employees: [savedEmployee], linkedUser: { id: 55n, email: savedEmployee.emailAddress, role: "teacher", userImage: null }, ...options });
    assert.equal((await h.services.updateEmployee(state, data)).success, false);
    assert.deepEqual(h.employees, [savedEmployee]);
    if (options.userWriteCount === 0) assert.equal(h.cleaned.length, 1);
  }
  for (const employees of [[], [{ ...savedEmployee, emailAddress: "root_user@example.com" }]]) {
    const h = harness({ employees });
    assert.equal((await h.services.updateEmployee(state, data)).success, false);
    assert.equal(h.events.includes("upload"), false);
  }
});

test("employee photo reads fall back to the linked account's legacy photo without returning ambiguous account data", async () => {
  const linkedUser: UserIdentity = { id: 55n, email: savedEmployee.emailAddress, role: "teacher", userImage: "https://old.example/photo.png" };
  const h = harness({ employees: [savedEmployee], linkedUser });
  assert.equal((await h.services.getEmployeeForEdit(savedEmployee.id.toString()))?.userImage, linkedUser.userImage);
  const conflicted = harness({ employees: [savedEmployee], identityError: true });
  assert.equal((await conflicted.services.getEmployeeForEdit(savedEmployee.id.toString()))?.userImage, null);
});
