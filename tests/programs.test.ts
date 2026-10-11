import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProgramForm } from "../lib/programs/validation";

function programForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    programId: "9007199254740993", code: " BSIT ", label: " Information Technology ",
    programType: "Bachelor", groupId: "college", slug: "information-technology",
    publicTitle: "Bachelor of Science in Information Technology", publicCode: "BSIT",
    overview: " Study computing. ", sortOrder: "0", ...overrides,
  })) form.set(key, value);
  return form;
}

test("program edits retain precise IDs, trim text and parse ordered topic/pathway lists", () => {
  const result = parseProgramForm(programForm({
    focusAreas: " Networking \r\n\nProgramming\nNetworking ",
    pathways: " Developer\n\nFurther study ", sortOrder: "12",
  }));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Valid program edit rejected");
  assert.equal(result.id, 9007199254740993n);
  assert.equal(result.data.code, "BSIT");
  assert.equal(result.data.overview, "Study computing.");
  assert.deepEqual(result.data.focusAreas, ["Networking", "Programming"]);
  assert.deepEqual(result.data.pathways, ["Developer", "Further study"]);
  assert.equal(result.data.sortOrder, 12);
  assert.equal(result.data.note, null);
  assert.equal("programTypeId" in result.data, false);
});

test("public programs require a complete course page while unlisted courses can retain content", () => {
  const incomplete = parseProgramForm(programForm({ publicTitle: "", overview: "" }));
  assert.equal(incomplete.success, false);
  if (incomplete.success) assert.fail("Incomplete public course accepted");
  assert.ok(incomplete.fieldErrors?.publicTitle);
  assert.ok(incomplete.fieldErrors?.overview);
  const unlisted = parseProgramForm(programForm({ groupId: "", publicTitle: "", overview: "" }));
  assert.equal(unlisted.success, true);
  if (!unlisted.success) assert.fail("Unlisted course rejected");
  assert.equal(unlisted.data.groupId, null);
  assert.equal(unlisted.data.publicTitle, null);
  assert.equal(unlisted.data.slug, "information-technology");
});

test("program editing rejects invalid types, route slugs, IDs and database sort values", () => {
  for (const programId of ["", "0", "-1", "1x", "9223372036854775808"]) {
    assert.equal(parseProgramForm(programForm({ programId })).success, false, programId);
  }
  const invalidValues: Record<string, string>[] = [
    { code: " " }, { label: "" }, { programType: "unknown" },
    { slug: "../login" }, { slug: "two--hyphens" }, { slug: "Uppercase" },
    ...["", "-1", "1.5", "1e2", "2147483648"].map((sortOrder) => ({ sortOrder })),
  ];
  for (const overrides of invalidValues) {
    assert.equal(parseProgramForm(programForm(overrides)).success, false, JSON.stringify(overrides));
  }
});
