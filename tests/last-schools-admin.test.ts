import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as enums from "../lib/generated/prisma/enums";
import * as records from "../lib/admission/records";
import * as identity from "../lib/admission/last-school-identity";
import * as fields from "../lib/admission/student-fields";
import * as utils from "../lib/utils";
import type * as admin from "../lib/last-schools/admin";

type Row = Record<string, unknown> & { id: bigint };
type Query = { where?: Record<string, unknown>; data?: Record<string, unknown>; select?: unknown };
const source = ts.transpileModule(readFileSync(new URL("../lib/last-schools/admin.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function form(overrides: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ schoolName: "Central School", schoolIdentifier: "00123", shortName: "CS", schoolType: "Public", street: "Main Road", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: "0100", ...overrides })) result.set(key, value);
  return result;
}

function harness(options: { deny?: boolean; duplicate?: bigint; resolveId?: bigint; failCommit?: boolean; conflict?: boolean; sharedWith?: "student" | "guardian" | "branch" | "lastSchool" } = {}) {
  const schools = new Map<bigint, Row>();
  const addresses = new Map<bigint, Row>();
  const calls: string[] = [];
  const reads: Query[] = [];
  const refreshed: string[] = [];
  const profiles: fields.UpdateStudentRecordInput[] = [];
  let nextId = 100n;
  const join = (row: Row) => ({ ...structuredClone(row), address: structuredClone(addresses.get(row.addressId as bigint) ?? null) });
  const matches = (row: Row, where: Query["where"]) => Object.entries(where ?? {}).every(([key, value]) => row[key] === value);
  const tx = {
    lastSchool: {
      findMany: async (query: Query) => { calls.push("lastSchool.findMany"); reads.push(query); return [...schools.values()].map((row) => ({ ...join(row), _count: { applications: 3 } })); },
      findUnique: async (query: Query) => { calls.push("lastSchool.findUnique"); reads.push(query); const row = schools.get(query.where?.id as bigint); return row ? join(row) : null; },
      update: async (query: Query) => { calls.push("lastSchool.update"); const row = schools.get(query.where?.id as bigint); assert.ok(row); Object.assign(row, structuredClone(query.data)); return join(row); },
      updateMany: async (query: Query) => { calls.push("lastSchool.updateMany"); const row = [...schools.values()].find((candidate) => matches(candidate, query.where)); if (!row || options.conflict) return { count: 0 }; Object.assign(row, structuredClone(query.data)); return { count: 1 }; },
      count: async () => options.sharedWith === "lastSchool" ? 2 : 1,
    },
    address: {
      create: async (query: Query) => { calls.push("address.create"); const row = { ...structuredClone(query.data), id: nextId++ }; addresses.set(row.id, row); return row; },
      update: async (query: Query) => { calls.push("address.update"); const row = addresses.get(query.where?.id as bigint); assert.ok(row); Object.assign(row, structuredClone(query.data)); return row; },
    },
    student: { count: async () => Number(options.sharedWith === "student") },
    guardian: { count: async () => Number(options.sharedWith === "guardian") },
    branch: { count: async () => Number(options.sharedWith === "branch") },
  };
  const modules: Record<string, unknown> = {
    "server-only": {}, "next/cache": { revalidatePath: (path: string) => refreshed.push(path) },
    "@/lib/auth": { requireAdmin: async () => { calls.push("auth"); if (options.deny) throw new Error("Forbidden"); } },
    "@/lib/prisma": { prisma: tx }, "@/lib/generated/prisma/enums": enums,
    "@/lib/admission/records": records, "@/lib/admission/last-school-identity": identity,
    "@/lib/admission/student-fields": fields, "@/lib/utils": utils,
    "@/lib/admission/last-school-store": {
      findMatchingLastSchool: async (_tx: unknown, profile: fields.UpdateStudentRecordInput, excluded: bigint) => { calls.push("findMatchingLastSchool"); profiles.push(profile); assert.equal(excluded, 71n); return options.duplicate ? { id: options.duplicate } : null; },
      resolveLastSchool: async (_tx: unknown, profile: fields.UpdateStudentRecordInput) => {
        calls.push("resolveLastSchool"); profiles.push(profile);
        if (options.resolveId) return { id: options.resolveId };
        const address = await tx.address.create({ data: fields.addressDataFromProfile(profile, "lastSchool") });
        const row = { ...fields.lastSchoolDataFromProfile(profile), id: nextId++, addressId: address.id, verificationStatus: "pending", reviewedAt: null, createdAt: new Date() };
        schools.set(row.id, row); return { id: row.id };
      },
      runLastSchoolTransaction: async (operation: (client: typeof tx) => Promise<unknown>) => {
        calls.push("transaction");
        const before = { schools: structuredClone([...schools]), addresses: structuredClone([...addresses]) };
        try { const result = await operation(tx); if (options.failCommit) throw new Error("Database unavailable"); return result; }
        catch (error) { schools.clear(); addresses.clear(); for (const [id, row] of before.schools) schools.set(id, row); for (const [id, row] of before.addresses) addresses.set(id, row); throw error; }
      },
    },
  };
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, Date, console: { error: () => undefined }, require: (name: string) => { assert.ok(name in modules, `Unexpected school dependency: ${name}`); return modules[name]; } });
  return {
    service: loaded.exports as typeof admin, schools, addresses, calls, reads, refreshed, profiles,
    seed(status = "pending", id = 71n) {
      addresses.set(id, { id, houseNumber: null, subdivision: null, street: "Main Road", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: "0100" });
      schools.set(id, { id, schoolName: "Central School", schoolId: null, shortName: "CS", schoolType: "Public", addressId: id, verificationStatus: status, createdAt: new Date("2026-10-01T00:00:00Z"), reviewedAt: status === "pending" ? null : new Date("2026-10-02T00:00:00Z"), protectedData: "must not leave the service" });
      return id;
    },
  };
}

test("school management authenticates before every read/write and returns exact JSON-safe minimal rows", async () => {
  const denied = harness({ deny: true });
  for (const operation of [() => denied.service.getManagedLastSchools(), () => denied.service.getManagedLastSchool("71"), () => denied.service.saveManagedLastSchool(form()), () => denied.service.reviewManagedLastSchool(form({ schoolId: "71", decision: "verify" }))]) await assert.rejects(operation, /Forbidden/);
  assert.deepEqual(denied.calls, ["auth", "auth", "auth", "auth"]);
  const h = harness(); h.seed("verified", 9223372036854775807n);
  h.schools.get(9223372036854775807n)!.schoolId = "00saved-Ab1";
  const rows = await h.service.getManagedLastSchools();
  const serialized = JSON.parse(JSON.stringify(rows));
  assert.equal(serialized[0].id, "9223372036854775807");
  assert.equal(serialized[0].createdAt, "2026-10-01T00:00:00.000Z");
  assert.equal(serialized[0].reviewedAt, "2026-10-02T00:00:00.000Z");
  assert.equal(serialized[0].applicationCount, 3);
  assert.equal(serialized[0].schoolIdentifier, "00saved-Ab1");
  assert.equal(serialized[0].protectedData, undefined);
  assert.equal(serialized[0].schoolId, undefined);
  assert.equal(serialized[0].addressId, undefined);
  const select = h.reads[0].select as Record<string, unknown>;
  assert.equal(select.applications, undefined, "Only the linked application count may be read");
  assert.deepEqual(JSON.parse(JSON.stringify(select._count)), { select: { applications: true } });
  const school = await h.service.getManagedLastSchool("9223372036854775807");
  assert.equal(school?.id, "9223372036854775807");
  assert.equal(school?.schoolIdentifier, "00saved-Ab1");
});

test("malformed IDs, incomplete school identities, invalid actions, and missing records cannot mutate data", async () => {
  for (const id of ["", "0", "-1", "071", "1.5", "71 OR TRUE", "9223372036854775808", "10000000000000000000"]) {
    const h = harness();
    assert.equal(await h.service.getManagedLastSchool(id), null);
    assert.equal((await h.service.saveManagedLastSchool(form({ schoolId: id }))).success, false);
    assert.equal((await h.service.reviewManagedLastSchool(form({ schoolId: id, decision: "verify" }))).success, false);
    assert.ok(h.calls.every((call) => call === "auth"));
  }
  const invalidForms: Record<string, string>[] = [{ schoolName: "" }, { barangay: "" }, { city: "" }, { province: "" }, { schoolType: "Forged" }, { schoolName: "x".repeat(256) }, { postalCode: "x".repeat(21) }, { intent: "delete" }];
  for (const overrides of invalidForms) {
    const h = harness();
    assert.equal((await h.service.saveManagedLastSchool(form(overrides))).success, false);
    assert.deepEqual(h.calls, ["auth"]);
    assert.equal(h.refreshed.length, 0);
  }
  const h = harness();
  assert.equal((await h.service.saveManagedLastSchool(form({ schoolId: "71" }))).success, false);
  assert.equal((await h.service.reviewManagedLastSchool(form({ schoolId: "71", decision: "verify" }))).success, false);
  assert.equal((await h.service.reviewManagedLastSchool(form({ schoolId: "71", decision: "delete" }))).success, false);
  assert.equal((await h.service.reviewManagedLastSchool(form({ id: "71", decision: "verify" }))).success, false, "Legacy form ID cannot authorize a review without schoolId");
  assert.equal(h.calls.some((call) => /create|update/.test(call)), false);
  assert.equal(h.refreshed.length, 0);
});

test("administrator creation sanitizes school details and verifies new or reused suggestions", async () => {
  for (const reuse of [false, true]) {
    const h = harness(reuse ? { resolveId: 71n } : {}); if (reuse) h.seed("pending");
    if (reuse) h.schools.get(71n)!.schoolId = "00abC-019";
    const result = await h.service.saveManagedLastSchool(form({ schoolName: " <b>central</b>  school <script>bad()</script>", schoolIdentifier: " <b>00abC-019</b> <script>bad()</script> ", shortName: "cs", street: " main\troad ", barangay: "central", city: "manila", province: "metro manila", postalCode: " <i>0100</i> ", verificationStatus: "rejected", reviewedAt: "1900-01-01" }));
    assert.equal(result.success, true);
    const saved = [...h.schools.values()][0];
    assert.equal(saved.verificationStatus, "verified");
    assert.ok(saved.reviewedAt instanceof Date);
    assert.ok((saved.reviewedAt as Date).getFullYear() > 2000);
    assert.equal(h.profiles[0].lastSchoolName, "Central School");
    assert.equal(h.profiles[0].lastSchoolId, "00abC-019");
    assert.equal(saved.schoolId, "00abC-019", "School identifiers retain leading zeros and intentional casing");
    assert.equal(h.profiles[0].lastSchoolStreet, "Main Road");
    assert.equal(h.profiles[0].lastSchoolPostalCode, "0100");
    assert.equal(h.schools.size, 1);
    assert.equal(h.addresses.size, 1, "Reusing a school must not make a second address");
    assert.ok(h.refreshed.includes("/admission"));
    assert.ok(h.refreshed.includes("/portal/admission-review"));
  }
});

test("administrator creation and editing require a nonblank school identifier of at most 100 characters", async () => {
  for (const editing of [false, true]) for (const schoolIdentifier of [undefined, "", " \t\r\n ", " <b></b> <script>bad()</script> ", "x".repeat(101)]) {
    const h = harness();
    if (editing) h.seed();
    const before = { schools: structuredClone([...h.schools]), addresses: structuredClone([...h.addresses]) };
    const data = form(editing ? { schoolId: "71" } : {});
    if (schoolIdentifier === undefined) data.delete("schoolIdentifier");
    else data.set("schoolIdentifier", schoolIdentifier);
    const result = await h.service.saveManagedLastSchool(data);
    assert.equal(result.success, false);
    assert.ok(result.fieldErrors?.schoolIdentifier, "The required School ID field identifies its validation error");
    assert.deepEqual(h.calls, ["auth"], "Invalid identifiers must fail before opening a transaction");
    assert.deepEqual([...h.schools], before.schools);
    assert.deepEqual([...h.addresses], before.addresses);
    assert.equal(h.refreshed.length, 0);
  }
  for (const editing of [false, true]) {
    const h = harness();
    if (editing) h.seed();
    const schoolIdentifier = `00${"aB".repeat(49)}`;
    assert.equal((await h.service.saveManagedLastSchool(form({ schoolIdentifier, ...(editing ? { schoolId: "71" } : {}) }))).success, true);
    assert.equal([...h.schools.values()][0].schoolId, schoolIdentifier, "The full 100-character identifier is accepted unchanged");
  }
});

test("school edits can add or change the official identifier without confusing it with the internal record ID", async () => {
  for (const savedIdentifier of [null, "00saved-Ab1"]) {
    for (const intent of ["save", "verify"]) {
      const h = harness(); h.seed();
      h.schools.get(71n)!.schoolId = savedIdentifier;
      const data = form({ schoolId: "71", schoolIdentifier: " <b>00new-XyZ</b> <script>bad()</script> ", intent });
      assert.equal((await h.service.saveManagedLastSchool(data)).success, true);
      assert.equal(h.schools.get(71n)!.schoolId, "00new-XyZ");
      assert.equal(h.profiles[0].lastSchoolId, "00new-XyZ");
      assert.equal(h.schools.get(71n)!.id, 71n);
      assert.equal(h.schools.get(71n)!.verificationStatus, intent === "verify" ? "verified" : "pending");
      assert.equal(h.schools.size, 1);
      assert.equal(h.addresses.size, 1);
    }
  }
});

test("editing preserves review state unless explicitly verified and safely reuses or copies school addresses", async () => {
  for (const status of ["pending", "rejected", "verified"]) for (const intent of ["save", "verify"]) {
    const h = harness(); h.seed(status);
    const reviewedAt = h.schools.get(71n)!.reviewedAt;
    const result = await h.service.saveManagedLastSchool(form({ schoolId: "71", intent, verificationStatus: "verified", id: "injected" }));
    assert.equal(result.success, true);
    assert.equal(h.schools.get(71n)!.verificationStatus, intent === "verify" ? "verified" : status);
    if (intent === "save" && status !== "verified") assert.deepEqual(h.schools.get(71n)!.reviewedAt, reviewedAt);
    assert.equal(h.schools.get(71n)!.schoolId, "00123");
    assert.equal(h.addresses.size, 1);
    assert.equal(h.calls.some((call) => call.startsWith("address.")), false, "Unchanged addresses should be reused without writes");
  }
  for (const sharedWith of [undefined, "student", "guardian", "branch", "lastSchool"] as const) {
    const h = harness({ sharedWith }); h.seed();
    const before = structuredClone(h.addresses.get(71n));
    assert.equal((await h.service.saveManagedLastSchool(form({ schoolId: "71", city: "Quezon City" }))).success, true);
    const addressId = h.schools.get(71n)!.addressId as bigint;
    assert.equal(h.addresses.get(addressId)!.city, "Quezon City");
    if (sharedWith) { assert.notEqual(addressId, 71n); assert.deepEqual(h.addresses.get(71n), before); assert.equal(h.calls.includes("address.update"), false); }
    else { assert.equal(addressId, 71n); assert.equal(h.addresses.size, 1); assert.ok(h.calls.includes("address.update")); }
  }
});

test("duplicates and failed commits leave linked schools and addresses intact and do not refresh caches", async () => {
  for (const options of [{ duplicate: 72n }, { failCommit: true, sharedWith: "branch" as const }]) {
    const h = harness(options); h.seed();
    const before = { schools: structuredClone([...h.schools]), addresses: structuredClone([...h.addresses]) };
    const result = await h.service.saveManagedLastSchool(form({ schoolId: "71", city: "Quezon City", intent: "verify" }));
    assert.equal(result.success, false);
    if (options.duplicate) { assert.match(result.fieldErrors?.schoolName ?? "", /already saved/); assert.equal(h.calls.some((call) => /address\.|lastSchool.update/.test(call)), false); }
    assert.deepEqual([...h.schools], before.schools);
    assert.deepEqual([...h.addresses], before.addresses);
    assert.equal(h.refreshed.length, 0);
  }
  const creating = harness({ failCommit: true });
  assert.equal((await creating.service.saveManagedLastSchool(form())).success, false);
  assert.equal(creating.schools.size, 0);
  assert.equal(creating.addresses.size, 0);
  assert.equal(creating.refreshed.length, 0);
});

test("review verifies only complete schools, rejects unverified suggestions, and detects changed records", async () => {
  for (const missing of ["schoolName", "schoolType", "barangay", "city", "province", "address"]) {
    const h = harness(); h.seed();
    if (missing === "address") h.schools.get(71n)!.addressId = null;
    else if (missing === "schoolName" || missing === "schoolType") h.schools.get(71n)![missing] = "";
    else h.addresses.get(71n)![missing] = "";
    assert.equal((await h.service.reviewManagedLastSchool(form({ schoolId: "71", decision: "verify" }))).success, false);
    assert.equal(h.schools.get(71n)!.verificationStatus, "pending");
    assert.equal(h.calls.includes("lastSchool.updateMany"), false);
    assert.equal(h.refreshed.length, 0);
  }
  for (const decision of ["verify", "reject"]) {
    const h = harness(); h.seed();
    assert.equal((await h.service.reviewManagedLastSchool(form({ schoolId: "71", decision, verificationStatus: "verified" }))).success, true);
    assert.equal(h.schools.get(71n)!.verificationStatus, decision === "verify" ? "verified" : "rejected");
    assert.equal(h.schools.get(71n)!.schoolId, null, "Suggestions can still be reviewed without a School ID");
    assert.ok(h.schools.get(71n)!.reviewedAt instanceof Date);
    assert.ok(h.refreshed.length > 0);
  }
  const verified = harness(); verified.seed("verified");
  assert.equal((await verified.service.reviewManagedLastSchool(form({ schoolId: "71", decision: "reject" }))).success, false);
  assert.equal(verified.schools.get(71n)!.verificationStatus, "verified");
  assert.equal(verified.refreshed.length, 0);
  for (const options of [{ conflict: true }, { failCommit: true }]) {
    const h = harness(options); h.seed();
    assert.equal((await h.service.reviewManagedLastSchool(form({ schoolId: "71", decision: "verify" }))).success, false);
    assert.equal(h.schools.get(71n)!.verificationStatus, "pending");
    assert.equal(h.refreshed.length, 0);
  }
});
