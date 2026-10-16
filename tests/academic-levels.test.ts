import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as levels from "../lib/academic-levels";
import * as utils from "../lib/utils";
import { AcademicLevel, Semester } from "../lib/generated/prisma/enums";
import type * as catalogServices from "../lib/admission/catalog";
import type * as portalServices from "../lib/portal/admission-options";

function loadModule<T>(path: string, modules: Record<string, unknown>) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  runInNewContext(code, {
    module: loaded, exports: loaded.exports, console,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected enum catalog dependency: " + name);
      return modules[name];
    },
  });
  return loaded.exports as T;
}

test("academic level choices cover the enum in display order without numeric IDs", () => {
  assert.deepEqual(levels.academicLevelOptions.map((level) => level.value), Object.values(AcademicLevel));
  assert.deepEqual(levels.academicLevelOptions.map((level) => level.label), [
    "Grade 11", "Grade 12", "First Year", "Second Year", "Third Year", "Fourth Year",
  ]);
  for (const option of levels.academicLevelOptions) {
    assert.equal(levels.formatAcademicLevel(option.value), option.label);
    assert.equal(levels.getAcademicLevelOption(option.value), option);
    assert.equal("id" in option, false);
  }
  for (const value of ["3", 3, "First Year", "firstYear", "first-year", null, "<b>FirstYear</b>"]) {
    assert.equal(levels.getAcademicLevelOption(value), undefined);
  }
});

test("program level compatibility retains college, senior-high and associate rules", () => {
  const expected: Record<string, string[]> = {
    Bachelor: ["FirstYear", "SecondYear", "ThirdYear", "FourthYear"],
    SeniorHigh: ["Grade11", "Grade12"], Associate: ["FirstYear", "SecondYear"],
    Unknown: [], toString: [], constructor: [],
  };
  for (const [programType, allowed] of Object.entries(expected)) {
    for (const value of Object.values(AcademicLevel)) {
      assert.equal(levels.isAcademicLevelAllowedForProgram(programType, value), allowed.includes(value), `${programType}: ${value}`);
    }
  }
});

test("semester choices reuse the existing enum, display readable labels and preserve unassigned legacy classes", () => {
  assert.deepEqual(levels.semesterOptions.map((option) => option.value), Object.values(Semester));
  assert.deepEqual(levels.semesterOptions.map((option) => option.label), ["1st Semester", "2nd Semester"]);
  for (const option of levels.semesterOptions) {
    assert.equal(levels.getSemesterOption(option.value), option);
    assert.equal(levels.formatSemester(option.value), option.label);
  }
  for (const value of ["", "First Semester", "1stSem", "firstsemester", 1, null, undefined, "__proto__"]) assert.equal(levels.getSemesterOption(value), undefined);
  assert.equal(levels.formatSemester(null), "Semester not assigned");
  assert.equal(levels.formatSemester(undefined), "Semester not assigned");
});

test("public offerings read branch assignments and derive compatible sorted enum levels without sections", async () => {
  const college = { id: 9007199254740993n, code: "BSIT", label: "Information Technology", programType: "Bachelor" };
  const seniorHigh = { id: 2n, code: "STEM", label: "STEM", programType: "SeniorHigh" };
  const associate = { id: 3n, code: "ACT", label: "Computer Technology", programType: "Associate" };
  const queries: Array<{ select: { branchPrograms: { select: Record<string, unknown> } } }> = [];
  const service = loadModule<typeof catalogServices>("../lib/admission/catalog.ts", {
    "next/cache": { unstable_cache: (fn: unknown) => fn },
    "@/lib/utils": utils, "@/lib/academic-levels": levels, "./records": { addressSelect: {} },
    "@/lib/prisma": { prisma: { branch: { findUnique: async (query: typeof queries[number]) => {
      queries.push(query);
      return { id: 7n, slug: "main", title: "Main", branchPrograms: [
        { program: college }, { program: college }, { program: seniorHigh }, { program: associate },
      ] };
    } } } },
  });
  const result = await service.getAdmissionProgramOptions("7");
  assert.equal(result.error, undefined);
  assert.equal("program" in queries[0].select.branchPrograms.select, true);
  assert.equal("sections" in queries[0].select, false);
  assert.equal("academicLevel" in queries[0].select.branchPrograms.select, false);
  assert.equal(result.programs.length, 3);
  assert.equal(result.programs[0].id, "9007199254740993");
  assert.equal(result.programs[0].academicLevels.map((option) => option.value).join(","), "FirstYear,SecondYear,ThirdYear,FourthYear");
  assert.equal(result.programs[1].academicLevels.map((option) => option.value).join(","), "Grade11,Grade12");
  assert.equal(result.programs[2].academicLevels.map((option) => option.value).join(","), "FirstYear,SecondYear");
  assert.equal(result.programs[0].academicLevels[0].label, "First Year");
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("portal year-level choices come from the enum without an academic-level database query", async () => {
  const reads: string[] = [];
  const service = loadModule<typeof portalServices>("../lib/portal/admission-options.ts", {
    "@/lib/academic-levels": levels,
    "@/lib/prisma": { prisma: {
      branch: { findMany: async () => { reads.push("branches"); return [{ id: 9007199254740993n, title: "Main" }]; } },
      program: { findMany: async () => { reads.push("programs"); return [{ id: 2n, code: "BSIT", label: "IT", programType: "Bachelor" }]; } },
    } },
  });
  const result = await service.getPortalAdmissionOptions(true);
  assert.deepEqual(reads, ["branches", "programs"]);
  assert.equal(result.branches[0].id, "9007199254740993");
  assert.equal(result.academicLevels.map((option) => option.value).join(","), Object.values(AcademicLevel).join(","));
  assert.equal(result.academicLevels[0].slug, "grade-11");
  assert.doesNotThrow(() => JSON.stringify(result));
});

test("public admission distinguishes unassigned and missing branches and rejects invalid IDs before lookup", async () => {
  let reads = 0;
  const service = loadModule<typeof catalogServices>("../lib/admission/catalog.ts", {
    "next/cache": { unstable_cache: (fn: unknown) => fn },
    "@/lib/utils": utils, "@/lib/academic-levels": levels, "./records": { addressSelect: {} },
    "@/lib/prisma": { prisma: { branch: { findUnique: async ({ where }: { where: { id: bigint } }) => {
      reads += 1;
      return where.id === 7n ? { id: 7n, slug: "main", title: "Main", branchPrograms: [] } : null;
    } } } },
  });

  for (const branchId of ["", "0", "-7", "7x", "9223372036854775808", "1".repeat(100)]) {
    const result = await service.getAdmissionProgramOptions(branchId);
    assert.match(result.error ?? "", /valid branchId/);
    assert.equal(result.programs.length, 0);
  }
  assert.equal(reads, 0);

  const empty = await service.getAdmissionProgramOptions("7");
  assert.equal(empty.error, undefined);
  assert.equal(empty.branch?.title, "Main");
  assert.equal(empty.programs.length, 0);

  const missing = await service.getAdmissionProgramOptions("8");
  assert.equal(missing.error, "Branch not found.");
  assert.equal(missing.programs.length, 0);
});
