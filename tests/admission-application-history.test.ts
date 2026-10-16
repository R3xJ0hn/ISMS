import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as utils from "../lib/utils";
import * as validation from "../lib/validation";
import * as constants from "../lib/admission/constants";
import * as studentFields from "../lib/admission/student-fields";
import { addressSelect } from "../lib/admission/records";
import * as enums from "../lib/generated/prisma/enums";
import * as academicLevels from "../lib/academic-levels";
import type * as admissionServices from "../lib/admission/applications";

type Application = {
  id: bigint;
  branch: { id: bigint; title: string };
  program: { label: string };
  academicLevel: enums.AcademicLevel;
  submittedAt: Date | null;
  createdAt: Date;
};
type SortOrder = "asc" | "desc" | { sort: "asc" | "desc"; nulls: "first" | "last" };
type RelationQuery = {
  where: { branchId: bigint };
  orderBy: Array<Record<string, SortOrder>>;
  take: number;
};
type StudentQuery = {
  where: { email: { equals: string; mode: string } };
  select: { applications: RelationQuery };
};

const code = ts.transpileModule(
  readFileSync(new URL("../lib/admission/applications.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } },
).outputText;
const input = {
  branchId: "7", studentNumber: "00123", studentEmail: "maria@example.com",
  firstName: "Maria", lastName: "Santos", birthDate: "2008-02-29",
};
const application: Application = {
  id: 1n, branch: { id: 7n, title: "Main" }, program: { label: "Information Technology" },
  academicLevel: "FirstYear", submittedAt: new Date("2026-06-01T00:00:00Z"),
  createdAt: new Date("2026-06-01T00:00:00Z"),
};

function relationRows(rows: Application[], query: RelationQuery): Application[] {
  return rows.filter((row) => row.branch.id === query.where.branchId).sort((left, right) => {
    for (const order of query.orderBy) {
      for (const [field, direction] of Object.entries(order)) {
        const first = left[field as keyof Application];
        const second = right[field as keyof Application];
        if (first === undefined || second === undefined) throw new Error("Unknown database order column");
        if (first === second) continue;
        if (first === null || second === null) {
          assert.equal(typeof direction, "object", "Nullable ordering must be explicit");
          const nulls = typeof direction === "object" ? direction.nulls : "first";
          return first === null ? nulls === "last" ? 1 : -1 : nulls === "last" ? -1 : 1;
        }
        const compared = first < second ? -1 : first > second ? 1 : 0;
        const sort = typeof direction === "object" ? direction.sort : direction;
        if (compared) return sort === "desc" ? -compared : compared;
      }
    }
    return 0;
  }).slice(0, query.take);
}

function verificationHarness(applications: Application[]) {
  const sentEmails: Array<{ to: string; studentName: string; updateUrl: string }> = [];
  const updateStudentIds: string[] = [];
  const queries: StudentQuery[] = [];
  const modules: Record<string, unknown> = {
    "./student-fields": studentFields,
    "./records": { addressSelect },
    "./last-school-store": { LastSchoolSelectionError: class extends Error {} },
    "node:crypto": { randomUUID: () => "unused-test-id" },
    "@/lib/generated/prisma/enums": enums,
    "@/lib/admission/submission-store": { saveAdmissionSubmission: () => assert.fail("Unexpected admission write") },
    "@/lib/admission/student-update-email": { sendStudentUpdateLinkEmail: async (email: typeof sentEmails[number]) => sentEmails.push(email) },
    "@/lib/admission/student-update": { createStudentUpdateUrl: async (id: string, recipient: string) => {
      assert.equal(recipient, input.studentEmail, "Bind link issuance to its actual email recipient");
      updateStudentIds.push(id);
      return "https://example.test/admission/update";
    } },
    "@/lib/utils": utils,
    "@/lib/academic-levels": academicLevels,
    "@/lib/validation": validation,
    "./constants": constants,
    "@/lib/prisma": { prisma: { student: { findFirst: async (query: StudentQuery) => {
      queries.push(query);
      return {
        id: 9007199254740993n, email: input.studentEmail, firstName: input.firstName, lastName: input.lastName,
        middleName: null, suffix: null,
        applications: relationRows(applications, query.select.applications),
      };
    } } } },
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    console: { info: () => {}, error: () => {} },
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected admission dependency: " + name);
      return modules[name];
    },
  });
  return { services: loaded.exports as typeof admissionServices, sentEmails, updateStudentIds, queries };
}

test("current student verification uses branch-scoped application history without enrollment or section queries", async () => {
  const harness = verificationHarness([application]);
  const result = await harness.services.verifyCurrentStudent(input);
  assert.equal(result.verified, true);
  assert.equal(result.student?.latestAdmission?.program, "Information Technology");
  assert.equal(result.student?.latestAdmission?.yearLevel, "First Year");
  assert.equal(result.student?.latestAdmission?.branch, "Main");
  assert.equal("schoolYear" in result.student!.latestAdmission!, false);
  assert.equal("section" in result.student!.latestAdmission!, false);
  assert.equal("enrollments" in harness.queries[0].select, false);
  assert.equal(harness.queries[0].select.applications.where.branchId, 7n);
  assert.equal(harness.queries[0].select.applications.take, 1);
  assert.deepEqual(harness.updateStudentIds, ["9007199254740993"]);
  assert.equal(harness.sentEmails.length, 1);
  assert.equal(harness.sentEmails[0].to, input.studentEmail);
});

test("latest application uses submission time, then creation time and ID, with drafts last", async () => {
  const submittedAt = new Date("2026-10-01T00:00:00Z");
  const createdAt = new Date("2026-10-01T00:00:00Z");
  const harness = verificationHarness([
    application,
    { ...application, id: 99n, submittedAt: null, createdAt: new Date("2027-01-01T00:00:00Z"), academicLevel: "FirstYear" },
    { ...application, id: 2n, submittedAt, createdAt: new Date("2026-09-30T00:00:00Z"), academicLevel: "SecondYear" },
    { ...application, id: 3n, submittedAt, createdAt, academicLevel: "ThirdYear" },
    { ...application, id: 4n, submittedAt, createdAt, academicLevel: "FourthYear" },
    { ...application, id: 100n, submittedAt: new Date("2028-01-01T00:00:00Z"), branch: { id: 8n, title: "Another branch" } },
  ]);
  const result = await harness.services.verifyCurrentStudent(input);
  assert.equal(result.verified, true);
  assert.equal(result.student?.latestAdmission?.yearLevel, "Fourth Year");
  assert.equal(result.student?.latestAdmission?.branch, "Main");
});

test("students without a saved application at the selected branch cannot verify or receive a link", async () => {
  for (const rows of [[], [{ ...application, branch: { id: 8n, title: "Another branch" } }]]) {
    const harness = verificationHarness(rows);
    const result = await harness.services.verifyCurrentStudent(input);
    assert.equal(result.verified, false);
    assert.equal(harness.sentEmails.length, 0);
    assert.equal(harness.updateStudentIds.length, 0);
  }
});

test("verification rejects invalid database IDs before lookup and matches email wildcard characters literally", async () => {
  for (const branchId of ["0", "-7", "7x", "9223372036854775808", "1".repeat(100)]) {
    const harness = verificationHarness([application]);
    assert.equal((await harness.services.verifyCurrentStudent({ ...input, branchId })).verified, false);
    assert.equal(harness.queries.length, 0);
    assert.equal(harness.sentEmails.length, 0);
  }
  const harness = verificationHarness([]);
  await harness.services.verifyCurrentStudent({ ...input, studentEmail: "maria_%@example.com" });
  assert.equal(harness.queries[0].where.email.equals, "maria\\_\\%@example.com");
});
