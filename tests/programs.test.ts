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
  assert.equal(result.data.overview, "Study Computing.");
  assert.deepEqual(result.data.focusAreas, ["Networking", "Programming"]);
  assert.deepEqual(result.data.pathways, ["Developer", "Further Study"]);
  assert.equal(result.data.sortOrder, 12);
  assert.equal(result.data.note, null);
  assert.equal("programTypeId" in result.data, false);
});

test("program write mapping sanitizes human text and capitalizes each topic and pathway line", () => {
  const result = parseProgramForm(programForm({
    code: "<b>bSiT</b>", label: " <b>information</b>\t technology ",
    publicTitle: "bachelor of science in IT", publicCode: " bSiT ",
    overview: "<i>study</i>\u200b computing.\n build skills.",
    note: "<strong>available</strong>\0 for working students",
    focusAreas: "<b>web</b> development\r\n\n networking \nweb development",
    pathways: "software\t engineer\rIT support\n\u200bIT support",
  }));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Sanitized program content was rejected");
  assert.deepEqual(result.data, {
    code: "bSiT", label: "Information Technology", programType: "Bachelor",
    groupId: "college", slug: "information-technology",
    publicTitle: "Bachelor Of Science In IT", publicCode: "bSiT",
    note: "Available For Working Students", overview: "Study Computing. Build Skills.",
    focusAreas: ["Web Development", "Networking"], pathways: ["Software Engineer", "IT Support"],
    sortOrder: 0,
  });
});

test("program required text rejects empty markup and category identifiers reject unsafe input", () => {
  for (const field of ["code", "label", "publicTitle", "publicCode", "overview"] as const) {
    const result = parseProgramForm(programForm({ [field]: "<b> </b>" }));
    assert.equal(result.success, false, field);
    if (result.success) assert.fail("Empty sanitized program text was accepted");
    assert.ok(result.fieldErrors?.[field]);
  }
  for (const groupId of ["<b>college</b>", "col\0lege", "col\u200blege"]) {
    const result = parseProgramForm(programForm({ groupId }));
    assert.equal(result.success, false, groupId);
    if (result.success) assert.fail("Unsafe category identifier was accepted");
    assert.ok(result.fieldErrors?.groupId);
  }
});

test("program lists remove script content across lines without losing real topic boundaries", () => {
  const result = parseProgramForm(programForm({
    focusAreas: "web development\n<script>\nunsafe content\n</script>\nnetworking",
    pathways: "software engineer\r\n<style>\nunsafe content\n</style>\nIT support",
  }));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Sanitized program lists were rejected");
  assert.deepEqual(result.data.focusAreas, ["Web Development", "Networking"]);
  assert.deepEqual(result.data.pathways, ["Software Engineer", "IT Support"]);
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
