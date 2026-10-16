import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as identity from "../lib/admission/last-school-identity";
import * as utils from "../lib/utils";
import type * as catalog from "../lib/admission/last-school-catalog";

const source = ts.transpileModule(readFileSync(new URL("../lib/admission/last-school-catalog.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
}).outputText;

function harness(failed = false) {
  const address = { houseNumber: null, subdivision: null, street: "Main", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: null };
  const base = { schoolName: "Central School", schoolId: null, shortName: null, schoolType: "Public", address };
  const rows = [
    { ...base, id: 1n, verificationStatus: "pending" },
    { ...base, id: 2n, schoolName: "Rejected School", verificationStatus: "rejected" },
    { ...base, id: 3n, verificationStatus: "verified" },
    { ...base, id: 4n, schoolName: " central school ", verificationStatus: "verified" },
    { ...base, id: 5n, schoolName: "", verificationStatus: "verified" },
    { ...base, id: 6n, address: null, verificationStatus: "verified" },
    { ...base, id: 7n, address: { ...address, city: "" }, verificationStatus: "verified" },
  ];
  const queries: Array<{ where: { verificationStatus: string }; select: Record<string, unknown> }> = [];
  const modules: Record<string, unknown> = {
    "@/lib/prisma": { prisma: { lastSchool: { findMany: async (query: typeof queries[number]) => {
      queries.push(query);
      if (failed) throw new Error("Synthetic database failure");
      return rows.filter((row) => row.verificationStatus === query.where.verificationStatus);
    } } } },
    "@/lib/utils": utils,
    "./last-school-identity": identity,
  };
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  return { service: loaded.exports as typeof catalog, queries };
}

test("the public school catalog returns only complete verified identities, deduplicated without student relationships", async () => {
  const h = harness();
  const result = await h.service.getAdmissionLastSchools();
  assert.equal(result.error, undefined);
  assert.equal(result.schools.length, 1);
  assert.equal(result.schools[0].id, "3");
  assert.equal(result.schools[0].schoolName, "Central School");
  assert.equal(h.queries[0].where.verificationStatus, "verified");
  for (const relationship of ["students", "applications", "admissionApplications"]) {
    assert.equal(relationship in h.queries[0].select, false);
  }
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("a failed school catalog gives a safe Other-school fallback", async () => {
  const result = await harness(true).service.getAdmissionLastSchools();
  assert.equal(result.schools.length, 0);
  assert.match(result.error ?? "", /Choose Other/);
  assert.doesNotMatch(result.error ?? "", /Synthetic|database/);
});
