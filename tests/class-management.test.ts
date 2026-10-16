import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as validation from "../lib/classes/validation";
import * as academicLevels from "../lib/academic-levels";
import type * as classServices from "../lib/classes/admin";

type Teacher = { id: bigint; role: string; emailVerified?: boolean };
type Assignment = {
  id: bigint;
  teacherId: bigint;
  branchId: bigint | null;
  programId: bigint | null;
  subjectId: bigint | null;
  schoolYear: string;
  sectionName: string;
  yearLevel: string;
  semester: string | null;
  subjectName: string;
  spreadsheetUrl: string | null;
};
type Query = {
  where?: {
    id?: bigint | { not?: bigint; in?: bigint[] };
    employeeId?: bigint;
    classId?: bigint;
    user?: { role: string; emailVerified: boolean };
    role?: string;
    teacherId?: bigint;
    branchId?: bigint;
    programId?: bigint;
    subjectId?: bigint;
    branchId_programId?: { branchId: bigint; programId: bigint };
    programId_subjectId?: { programId: bigint; subjectId: bigint };
    schoolYear?: string;
    sectionName?: string;
    yearLevel?: string;
    semester?: string | null;
    subjectName?: string;
  };
  data?: Record<string, unknown> | Array<Record<string, unknown>>;
  select?: Record<string, unknown>;
};
type Call = { method: string; query: Query };

class DatabaseError extends Error {
  constructor(public code: string) { super("Internal database details"); }
}

const serviceCode = ts.transpileModule(
  readFileSync(new URL("../lib/classes/admin.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;

const savedTeacher: Teacher = { id: 9007199254740995n, role: "teacher" };
const savedClass: Assignment = {
  id: 9007199254740993n, teacherId: savedTeacher.id, branchId: 9007199254740997n, schoolYear: "2026-2027",
  programId: 9007199254740999n, subjectId: 9007199254741001n,
  sectionName: "BSIT 1A", yearLevel: "FirstYear", semester: "FirstSemester", subjectName: "Computing",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet_123/edit#gid=7",
};
const createdId = 100n;
const state = { success: false, message: "" };

function classForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [field, value] of Object.entries({
    classId: savedClass.id.toString(), teacherId: savedTeacher.id.toString(),
    branchId: savedClass.branchId!.toString(),
    programId: savedClass.programId!.toString(), subjectId: savedClass.subjectId!.toString(),
    schoolYear: savedClass.schoolYear, sectionName: savedClass.sectionName,
    yearLevel: savedClass.yearLevel, semester: savedClass.semester ?? "", subjectName: savedClass.subjectName, ...overrides,
  })) form.set(field, value);
  return form;
}

function serviceHarness(options: {
  denied?: boolean;
  teachers?: Teacher[];
  classes?: Assignment[];
  writeError?: string;
  students?: bigint[];
  roster?: Array<{ classId: bigint; studentId: bigint }>;
  rosterWriteError?: boolean;
  branches?: bigint[];
  offerings?: Array<{ branchId: bigint; programId: bigint; programType: string }>;
  subjects?: Array<{ programId: bigint; subjectId: bigint; name: string }>;
} = {}) {
  const calls: Call[] = [];
  const events: string[] = [];
  const revalidated: string[] = [];
  const loggedErrors: unknown[][] = [];
  const teachers = structuredClone(options.teachers ?? [savedTeacher]);
  const classes = structuredClone(options.classes ?? []);
  const students = options.students ?? [9007199254740997n, 9007199254740999n];
  const branches = options.branches ?? [savedClass.branchId!, 25n];
  const offerings = options.offerings ?? branches.map((branchId) => ({ branchId, programId: savedClass.programId!, programType: "Bachelor" }));
  const subjects = options.subjects ?? [{ programId: savedClass.programId!, subjectId: savedClass.subjectId!, name: savedClass.subjectName }];
  const roster = structuredClone(options.roster ?? []);
  function record(method: string, query: Query) {
    calls.push({ method, query: structuredClone(query) });
  }
  function checkWriteError() {
    if (options.writeError === "unexpected") throw new Error("Internal database details");
    if (options.writeError) throw new DatabaseError(options.writeError);
  }
  const teacher = {
    async findFirst(query: Query) {
      record("teacher.findFirst", query);
      return teachers.find((teacher) => teacher.id === query.where?.employeeId && teacher.role === query.where?.user?.role &&
        (teacher.emailVerified ?? true) === query.where?.user?.emailVerified) ?? null;
    },
  };
  const branch = { async findUnique(query: Query) {
    record("branch.findUnique", query);
    return branches.includes(query.where?.id as bigint) ? { id: query.where?.id } : null;
  } };
  const branchProgram = { async findUnique(query: Query) {
    record("branchProgram.findUnique", query);
    const found = offerings.find((entry) => entry.branchId === query.where?.branchId_programId?.branchId && entry.programId === query.where?.branchId_programId?.programId);
    return found ? { program: { programType: found.programType } } : null;
  } };
  const programSubject = { async findUnique(query: Query) {
    record("programSubject.findUnique", query);
    const found = subjects.find((entry) => entry.programId === query.where?.programId_subjectId?.programId && entry.subjectId === query.where?.programId_subjectId?.subjectId);
    return found ? { subject: { name: found.name } } : null;
  } };
  const classDelegate = {
    async findUnique(query: Query) {
      record("class.findUnique", query);
      return classes.find((assignment) => assignment.id === query.where?.id) ?? null;
    },
    async findFirst(query: Query) {
      record("class.findFirst", query);
      const { id, ...fields } = query.where ?? {};
      return classes.find((assignment) =>
        (typeof id === "bigint" ? assignment.id === id : !id || assignment.id !== id.not) &&
        Object.entries(fields).every(([field, value]) => assignment[field as keyof Assignment] === value),
      ) ?? null;
    },
    async create(query: Query) {
      record("class.create", query);
      checkWriteError();
      classes.push({ id: createdId, spreadsheetUrl: null, ...query.data } as Assignment);
      return { id: createdId };
    },
    async update(query: Query) {
      record("class.update", query);
      checkWriteError();
      const assignment = classes.find((classRecord) => classRecord.id === query.where?.id);
      if (assignment) Object.assign(assignment, query.data);
      return { id: query.where?.id };
    },
  };
  const student = { async count(query: Query) {
    record("student.count", query);
    const ids = typeof query.where?.id === "object" ? query.where.id.in ?? [] : [];
    return students.filter((id) => ids.includes(id)).length;
  } };
  const classStudent = {
    async deleteMany(query: Query) {
      record("classStudent.deleteMany", query);
      for (let index = roster.length - 1; index >= 0; index--) if (roster[index].classId === query.where?.classId) roster.splice(index, 1);
    },
    async createMany(query: Query) {
      record("classStudent.createMany", query);
      if (options.rosterWriteError) throw new DatabaseError("P2034");
      roster.push(...structuredClone(query.data) as Array<{ classId: bigint; studentId: bigint }>);
    },
  };
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireSuperAdmin: async () => {
      events.push("authorize");
      if (options.denied) throw new Error("Access denied");
    } },
    "@/lib/generated/prisma/client": { Prisma: {
      PrismaClientKnownRequestError: DatabaseError,
      TransactionIsolationLevel: { Serializable: "Serializable" },
    } },
    "@/lib/generated/prisma/enums": { UserRole: { teacher: "teacher" } },
    "@/lib/academic-levels": academicLevels,
    "@/lib/prisma": { prisma: { $transaction: async (
      callback: (transaction: { teacher: typeof teacher; branch: typeof branch; branchProgram: typeof branchProgram; programSubject: typeof programSubject; student: typeof student; class: typeof classDelegate; classStudent: typeof classStudent }) => Promise<unknown>,
      transactionOptions: { isolationLevel: string },
    ) => {
      events.push("transaction");
      assert.equal(transactionOptions.isolationLevel, "Serializable");
      const beforeClasses = structuredClone(classes), beforeRoster = structuredClone(roster);
      try { return await callback({ teacher, branch, branchProgram, programSubject, student, class: classDelegate, classStudent }); }
      catch (error) { classes.splice(0, classes.length, ...beforeClasses); roster.splice(0, roster.length, ...beforeRoster); throw error; }
    } } },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "./validation": { ...validation, parseClassForm: (formData: FormData, mode: "create" | "edit") => {
      events.push("parse");
      return validation.parseClassForm(formData, mode);
    } },
  };
  const loaded = { exports: {} };
  // Exercise production services with isolated imports; no database or session is opened.
  runInNewContext(serviceCode, {
    module: loaded, exports: loaded.exports,
    console: { error: (...args: unknown[]) => loggedErrors.push(args) },
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected service dependency: ${name}`);
      return modules[name];
    },
  });
  return { services: loaded.exports as typeof classServices, calls, events, revalidated, loggedErrors, classes, roster };
}

function writes(calls: Call[]) {
  return calls.filter((call) => call.method === "class.create" || call.method === "class.update");
}

test("class services deny access before parsing or touching the database", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const harness = serviceHarness({ denied: true });
    await assert.rejects(harness.services[method](state, classForm()), /Access denied/);
    assert.deepEqual(harness.events, ["authorize"]);
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.revalidated.length, 0);
  }
});

test("invalid class submissions return validation errors without querying or mutating", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const harness = serviceHarness();
    const result = await harness.services[method](state, classForm({ teacherId: "0", sectionName: "" }));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.teacherId);
    assert.ok(result.fieldErrors?.sectionName);
    assert.deepEqual(harness.events, ["authorize", "parse"]);
    assert.equal(harness.calls.length, 0);
    assert.equal(harness.revalidated.length, 0);
  }
});

test("class assignments reject every nonteacher role and missing teacher accounts", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    for (const role of ["superAdmin", "admin", "registrar", "student", null]) {
      const harness = serviceHarness({
        teachers: role ? [{ ...savedTeacher, role }] : [], classes: [savedClass],
      });
      const result = await harness.services[method](state, classForm({ role: "teacher" }));
      assert.equal(result.success, false, `${method}: ${role}`);
      assert.ok(result.fieldErrors?.teacherId);
      assert.deepEqual(harness.calls.find((call) => call.method === "teacher.findFirst")?.query, {
        where: { employeeId: savedTeacher.id, user: { role: "teacher", emailVerified: true } }, select: { employeeId: true },
      });
      assert.equal(writes(harness.calls).length, 0);
      assert.equal(harness.revalidated.length, 0);
    }
  }
});

test("duplicate assignment checks block creates and edits without writing", async () => {
  const duplicate = { ...savedClass, id: 2n };
  for (const method of ["createClass", "updateClass"] as const) {
    const harness = serviceHarness({ classes: method === "createClass" ? [duplicate] : [savedClass, duplicate] });
    const result = await harness.services[method](state, classForm());
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.subjectId);
    assert.equal(writes(harness.calls).length, 0);
    assert.equal(harness.revalidated.length, 0);
    assert.equal(harness.calls.find((call) => call.method === "class.findFirst")?.query.where?.semester, "FirstSemester");
  }
});

test("the same section and subject can be saved in different semesters without changing its roster or sheet", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const otherTerm = { ...savedClass, id: 2n, semester: "SecondSemester" };
    const classes = method === "createClass" ? [otherTerm] : [savedClass, otherTerm];
    const roster = [{ classId: 2n, studentId: 9007199254740999n }];
    const harness = serviceHarness({ classes, roster });
    assert.equal((await harness.services[method](state, classForm())).success, true);
    assert.equal(harness.calls.find((call) => call.method === "class.findFirst")?.query.where?.semester, "FirstSemester");
    const stored = harness.classes.find((assignment) => assignment.id === (method === "createClass" ? createdId : savedClass.id));
    assert.equal(stored?.semester, "FirstSemester");
    assert.equal(harness.classes.find((assignment) => assignment.id === 2n)?.semester, "SecondSemester");
    assert.deepEqual(harness.roster, roster);
    if (method === "updateClass") assert.equal(stored?.spreadsheetUrl, savedClass.spreadsheetUrl);
  }
});

test("a legacy class requires an explicit semester on edit and retains its linked spreadsheet and students", async () => {
  const roster = [{ classId: savedClass.id, studentId: 9007199254740997n }];
  const harness = serviceHarness({ classes: [{ ...savedClass, semester: null }], roster });
  const missing = await harness.services.updateClass(state, classForm({ semester: "" }));
  assert.equal(missing.success, false);
  assert.ok(missing.fieldErrors?.semester);
  assert.equal(harness.calls.length, 0);
  assert.equal(harness.classes[0].semester, null);
  assert.equal((await harness.services.updateClass(state, classForm({ semester: "SecondSemester" }))).success, true);
  assert.equal(harness.classes[0].semester, "SecondSemester");
  assert.equal(harness.classes[0].spreadsheetUrl, savedClass.spreadsheetUrl);
  assert.deepEqual(harness.roster, roster);
});

test("class saves reject unavailable branches before changing metadata or memberships", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const harness = serviceHarness({ branches: [], classes: [savedClass], roster: [{ classId: savedClass.id, studentId: 9007199254740997n }] });
    const beforeClasses = structuredClone(harness.classes), beforeRoster = structuredClone(harness.roster);
    const form = classForm({ sectionName: "Updated Section" });
    form.set("studentIds", "9007199254740999");
    const result = await harness.services[method](state, form);
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.branchId);
    assert.deepEqual(harness.calls.find((call) => call.method === "branch.findUnique")?.query, { where: { id: savedClass.branchId }, select: { id: true } });
    assert.equal(writes(harness.calls).length, 0);
    assert.deepEqual(harness.classes, beforeClasses);
    assert.deepEqual(harness.roster, beforeRoster);
    assert.deepEqual(harness.revalidated, []);
  }
});

test("class saves reject programs not offered by the selected branch before metadata or roster writes", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    for (const offerings of [[], [{ branchId: 25n, programId: savedClass.programId!, programType: "Bachelor" }]]) {
      const harness = serviceHarness({ offerings, classes: [savedClass], roster: [{ classId: savedClass.id, studentId: 9007199254740997n }] });
      const originalClasses = structuredClone(harness.classes), originalRoster = structuredClone(harness.roster);
      const form = classForm({ sectionName: "Changed" }); form.set("studentIds", "9007199254740999");
      const result = await harness.services[method](state, form);
      assert.equal(result.success, false);
      assert.ok(result.fieldErrors?.programId);
      assert.deepEqual(harness.calls.find((call) => call.method === "branchProgram.findUnique")?.query, {
        where: { branchId_programId: { branchId: savedClass.branchId, programId: savedClass.programId } }, select: { program: { select: { programType: true } } },
      });
      assert.equal(harness.calls.some((call) => call.method === "programSubject.findUnique"), false);
      assert.equal(writes(harness.calls).length, 0);
      assert.deepEqual(harness.classes, originalClasses);
      assert.deepEqual(harness.roster, originalRoster);
      assert.deepEqual(harness.revalidated, []);
    }
  }
});

test("class saves reject unassigned and other-program subjects before metadata or roster writes", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    for (const subjects of [[], [{ programId: 25n, subjectId: savedClass.subjectId!, name: "Other Program Subject" }]]) {
      const harness = serviceHarness({ subjects, classes: [savedClass], roster: [{ classId: savedClass.id, studentId: 9007199254740997n }] });
      const originalClasses = structuredClone(harness.classes), originalRoster = structuredClone(harness.roster);
      const form = classForm({ sectionName: "Changed" }); form.set("studentIds", "9007199254740999");
      const result = await harness.services[method](state, form);
      assert.equal(result.success, false);
      assert.ok(result.fieldErrors?.subjectId);
      assert.deepEqual(harness.calls.find((call) => call.method === "programSubject.findUnique")?.query, {
        where: { programId_subjectId: { programId: savedClass.programId, subjectId: savedClass.subjectId } }, select: { subject: { select: { name: true } } },
      });
      assert.equal(writes(harness.calls).length, 0);
      assert.deepEqual(harness.classes, originalClasses);
      assert.deepEqual(harness.roster, originalRoster);
      assert.deepEqual(harness.revalidated, []);
    }
  }
});

test("the saved subject name supplies the class snapshot and forged manual names have no effect", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const canonicalName = "Information Systems & IT";
    const harness = serviceHarness({ classes: [savedClass], subjects: [{ programId: savedClass.programId!, subjectId: savedClass.subjectId!, name: canonicalName }] });
    const form = classForm({ subjectName: "Forged Subject", sectionName: "BSIT 1B" });
    const result = await harness.services[method](state, form);
    assert.equal(result.success, true);
    const saved = writes(harness.calls)[0].query.data as Record<string, unknown>;
    assert.equal(saved.subjectName, canonicalName);
    assert.equal(saved.subjectId, savedClass.subjectId);
    assert.equal(saved.programId, savedClass.programId);
  }
});

test("classes reject year levels outside the branch program type", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    for (const [programType, validLevel, invalidLevel] of [["SeniorHigh", "Grade12", "FirstYear"], ["Associate", "SecondYear", "FourthYear"], ["Bachelor", "FourthYear", "Grade11"]]) {
      const offerings = [{ branchId: savedClass.branchId!, programId: savedClass.programId!, programType }];
      const valid = serviceHarness({ offerings, classes: [savedClass] });
      assert.equal((await valid.services[method](state, classForm({ yearLevel: validLevel }))).success, true);
      const invalid = serviceHarness({ offerings, classes: [savedClass] });
      const result = await invalid.services[method](state, classForm({ yearLevel: invalidLevel }));
      assert.equal(result.success, false);
      assert.ok(result.fieldErrors?.yearLevel);
      assert.equal(writes(invalid.calls).length, 0);
    }
  }
});

test("identical section and subject assignments remain distinct across programs", async () => {
  const otherProgram = { ...savedClass, id: 2n, programId: 25n };
  for (const method of ["createClass", "updateClass"] as const) {
    const harness = serviceHarness({ classes: method === "createClass" ? [otherProgram] : [savedClass, otherProgram] });
    assert.equal((await harness.services[method](state, classForm())).success, true);
    const duplicate = harness.calls.find((call) => call.method === "class.findFirst")?.query.where;
    assert.equal(duplicate?.programId, savedClass.programId);
    assert.equal(duplicate?.subjectId, savedClass.subjectId);
    assert.equal("subjectName" in (duplicate ?? {}), false);
  }
});

test("legacy classes require explicit program choices before editing and preserve saved links", async () => {
  const harness = serviceHarness({ classes: [{ ...savedClass, programId: null, subjectId: null }] });
  const rejected = await harness.services.updateClass(state, classForm({ programId: "" }));
  assert.equal(rejected.success, false);
  assert.ok(rejected.fieldErrors?.programId);
  assert.equal(writes(harness.calls).length, 0);
  assert.equal((await harness.services.updateClass(state, classForm())).success, true);
  assert.equal(harness.classes[0].programId, savedClass.programId);
  assert.equal(harness.classes[0].subjectId, savedClass.subjectId);
  assert.equal(harness.classes[0].spreadsheetUrl, savedClass.spreadsheetUrl);
});

test("identical class assignments are distinct across branches and a legacy class can receive its first branch", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const otherBranch = { ...savedClass, id: 2n, branchId: 25n };
    const harness = serviceHarness({ classes: method === "createClass" ? [otherBranch] : [{ ...savedClass, branchId: null }, otherBranch] });
    const result = await harness.services[method](state, classForm());
    assert.equal(result.success, true);
    const duplicateQuery = harness.calls.find((call) => call.method === "class.findFirst")?.query.where;
    assert.equal(duplicateQuery?.branchId, savedClass.branchId);
    assert.equal(harness.classes.find((assignment) => assignment.id === (method === "createClass" ? createdId : savedClass.id))?.branchId, savedClass.branchId);
  }
});

test("an unverified account or a user ID without its teacher profile cannot receive class assignments", async () => {
  for (const options of [{ teachers: [{ ...savedTeacher, emailVerified: false }] }, {}]) {
    const harness = serviceHarness(options);
    const result = await harness.services.createClass(state, classForm(options.teachers ? {} : { teacherId: "25" }));
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.teacherId);
    assert.equal(writes(harness.calls).length, 0);
  }
});

test("class creation links saved students without student user accounts and ignores forged credentials", async () => {
  const harness = serviceHarness();
  const form = classForm({ userId: "25", studentId: "25", password: "ignored" });
  form.append("studentIds", "");
  form.append("studentIds", "9007199254740997");
  form.append("studentIds", "9007199254740999");
  assert.equal((await harness.services.createClass(state, form)).success, true);
  assert.deepEqual(harness.roster, [{ classId: createdId, studentId: 9007199254740997n }, { classId: createdId, studentId: 9007199254740999n }]);
  assert.equal(harness.calls.some((call) => call.method.startsWith("user.")), false);
});

test("missing or invalid roster students prevent class and membership writes", async () => {
  for (const studentId of ["0", "bad", "9223372036854775808", "99"]) {
    const harness = serviceHarness({ classes: [savedClass] });
    const form = classForm();
    form.append("studentIds", studentId);
    assert.equal((await harness.services.updateClass(state, form)).success, false);
    assert.equal(writes(harness.calls).length, 0);
    assert.equal(harness.roster.length, 0);
    assert.equal(harness.revalidated.length, 0);
  }
});

test("roster edits preserve omitted selections, replace explicit selections, and allow an empty roster", async () => {
  const harness = serviceHarness({ classes: [savedClass], roster: [{ classId: savedClass.id, studentId: 9007199254740997n }] });
  assert.equal((await harness.services.updateClass(state, classForm())).success, true);
  assert.deepEqual(harness.roster, [{ classId: savedClass.id, studentId: 9007199254740997n }]);
  const replace = classForm();
  replace.append("studentIds", "9007199254740999");
  replace.append("studentIds", "9007199254740999");
  assert.equal((await harness.services.updateClass(state, replace)).success, true);
  assert.deepEqual(harness.roster, [{ classId: savedClass.id, studentId: 9007199254740999n }]);
  const clear = classForm(); clear.set("studentIds", "");
  assert.equal((await harness.services.updateClass(state, clear)).success, true);
  assert.deepEqual(harness.roster, []);
  assert.equal(harness.classes[0].spreadsheetUrl, savedClass.spreadsheetUrl);
});

test("a roster failure rolls back the class metadata and its old memberships together", async () => {
  for (const method of ["createClass", "updateClass"] as const) {
    const harness = serviceHarness({ classes: [savedClass], roster: [{ classId: savedClass.id, studentId: 9007199254740997n }], rosterWriteError: true });
    const beforeClasses = structuredClone(harness.classes), beforeRoster = structuredClone(harness.roster);
    const form = classForm({ sectionName: "Updated Section" });
    form.set("studentIds", "9007199254740999");
    assert.equal((await harness.services[method](state, form)).success, false);
    assert.deepEqual(harness.classes, beforeClasses);
    assert.deepEqual(harness.roster, beforeRoster);
    assert.deepEqual(harness.revalidated, []);
  }
});

test("creating a class needs no spreadsheet and saves only normalized assignment data", async () => {
  const harness = serviceHarness();
  const result = await harness.services.createClass(state, classForm({
    schoolYear: " 2026 - 2027 ", sectionName: " BSIT 1A ",
    role: "superAdmin", createdAt: "forged", teacher: "forged",
  }));
  assert.equal(result.success, true);
  assert.deepEqual(harness.events, ["authorize", "parse", "transaction"]);
  const created = harness.calls.find((call) => call.method === "class.create")?.query;
  const assignmentData = Object.fromEntries(Object.entries(savedClass).filter(([field]) => field !== "id" && field !== "spreadsheetUrl"));
  assert.deepEqual(created, { data: assignmentData, select: { id: true } });
  assert.deepEqual(harness.revalidated, [
    "/portal/classes", `/portal/classes/${createdId}/edit`, "/portal/my-classes", `/portal/my-classes/${createdId}`,
    "/portal/classroom", `/portal/classroom/${createdId}`, "/portal/grades",
  ]);
  assert.equal("data" in result, false);
  assert.equal("spreadsheetUrl" in (created?.data ?? {}), false);
});

test("superadmin class creation ignores a forged teacher spreadsheet link", async () => {
  const harness = serviceHarness();
  const result = await harness.services.createClass(state, classForm({
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/forged/edit",
  }));
  assert.equal(result.success, true);
  const created = harness.calls.find((call) => call.method === "class.create")?.query;
  assert.equal("spreadsheetUrl" in (created?.data ?? {}), false);
});

test("editing a class can reassign its teacher while preserving the teacher's spreadsheet link", async () => {
  const replacementTeacher = { id: 9223372036854775806n, role: "teacher" };
  const harness = serviceHarness({ teachers: [savedTeacher, replacementTeacher], classes: [savedClass] });
  const result = await harness.services.updateClass(state, classForm({
    teacherId: replacementTeacher.id.toString(), spreadsheetUrl: "https://docs.google.com/spreadsheets/d/forged/edit",
  }));
  assert.equal(result.success, true);
  assert.deepEqual(harness.calls[0], {
    method: "class.findUnique", query: { where: { id: savedClass.id }, select: { id: true } },
  });
  assert.deepEqual(harness.calls.find((call) => call.method === "teacher.findFirst")?.query.where, {
    employeeId: replacementTeacher.id, user: { role: "teacher", emailVerified: true },
  });
  const duplicateQuery = harness.calls.find((call) => call.method === "class.findFirst")?.query.where;
  assert.deepEqual(duplicateQuery?.id, { not: savedClass.id });
  assert.equal(duplicateQuery?.teacherId, replacementTeacher.id);
  const assignmentData = Object.fromEntries(Object.entries(savedClass).filter(([field]) => field !== "id" && field !== "spreadsheetUrl"));
  assert.deepEqual(harness.calls.find((call) => call.method === "class.update")?.query, {
    where: { id: savedClass.id }, data: { ...assignmentData, teacherId: replacementTeacher.id }, select: { id: true },
  });
  assert.deepEqual(harness.revalidated, [
    "/portal/classes", `/portal/classes/${savedClass.id}/edit`, "/portal/my-classes", `/portal/my-classes/${savedClass.id}`,
    "/portal/classroom", `/portal/classroom/${savedClass.id}`, "/portal/grades",
  ]);
  assert.equal(harness.classes[0].spreadsheetUrl, savedClass.spreadsheetUrl);
});

test("missing classes and Prisma write conflicts return safe errors without revalidation", async () => {
  const missing = serviceHarness();
  const missingResult = await missing.services.updateClass(state, classForm());
  assert.equal(missingResult.success, false);
  assert.ok(missingResult.fieldErrors?.classId);
  assert.equal(missing.calls.length, 1);
  assert.equal(writes(missing.calls).length, 0);
  assert.equal(missing.revalidated.length, 0);

  for (const [writeError, field] of [
    ["P2002", "subjectId"], ["P2025", "classId"], ["P2003", null], ["P2034", null], ["unexpected", null],
  ] as const) {
    const harness = serviceHarness({ classes: [savedClass], writeError });
    const result = await harness.services.updateClass(state, classForm());
    assert.equal(result.success, false, writeError);
    if (field) assert.ok(result.fieldErrors?.[field]);
    else assert.match(result.message, /try again/i);
    assert.doesNotMatch(result.message, /Internal database details/);
    assert.equal(harness.revalidated.length, 0);
    assert.equal(harness.loggedErrors.length, writeError === "unexpected" ? 1 : 0);
  }
});
