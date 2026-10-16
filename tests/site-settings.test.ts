import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SITE_SETTINGS } from "../lib/site-settings/defaults";
import { parseAboutSettings, parseContactSettings, safeExternalUrl, siteSettingsLimits } from "../lib/site-settings/validation";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...DEFAULT_SITE_SETTINGS, ...overrides })) data.set(key, value);
  return data;
}

test("about settings sanitize and capitalize human text while preserving paragraph boundaries", () => {
  const result = parseAboutSettings(form({ aboutTitle: " <b>about</b> our school ", aboutIntro: "<p>learn</p> with us.\r\n\r\n<script>private script</script> build skills.", mission: " <i>serve</i> our students ", vision: " support every learner ", contactEmail: "injected@example.test", userId: "7" }));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Valid about settings rejected");
  assert.deepEqual(result.data, { aboutTitle: "About Our School", aboutIntro: "Learn With Us.\n\nBuild Skills.", mission: "Serve Our Students", vision: "Support Every Learner" });
  assert.equal("contactEmail" in result.data, false);
  assert.equal("userId" in result.data, false);
});

test("about settings allow optional mission and vision to be cleared but require title and introduction", () => {
  const cleared = parseAboutSettings(form({ mission: "", vision: "" }));
  assert.equal(cleared.success, true);
  if (cleared.success) assert.equal(cleared.data.mission + cleared.data.vision, "");
  for (const field of ["aboutTitle", "aboutIntro"] as const) {
    const result = parseAboutSettings(form({ [field]: "<script>unsafe</script><b> </b>" }));
    assert.equal(result.success, false, field);
    if (!result.success) assert.ok(result.fieldErrors?.[field]);
  }
});

test("contact settings normalize email and preserve phone and URL identity rather than capitalizing them", () => {
  const result = parseContactSettings(form({ contactIntro: "<b>visit</b> our campus.\n meet our team.", contactEmail: " SYNTHETIC.Registrar@EXAMPLE.TEST ", contactPhone: " +63 (912) 345-6789 ", contactAddress: "<b>123</b> synthetic street", officeHours: " monday to friday\n8 am - 5 pm ", mapUrl: " https://maps.example.test/CaseSensitive?x=abC ", facebookUrl: "http://social.example.test/Campus", officialWebsiteUrl: "https://website.example.test/Admissions", aboutTitle: "Injected about", passwordHash: "unused" }));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Valid contact settings rejected");
  assert.deepEqual(result.data, { contactIntro: "Visit Our Campus.\nMeet Our Team.", contactEmail: "synthetic.registrar@example.test", contactPhone: "+63 (912) 345-6789", contactAddress: "123 Synthetic Street", officeHours: "Monday To Friday\n8 Am - 5 Pm", mapUrl: "https://maps.example.test/CaseSensitive?x=abC", facebookUrl: "http://social.example.test/Campus", officialWebsiteUrl: "https://website.example.test/Admissions" });
  assert.equal("aboutTitle" in result.data, false);
  assert.equal("passwordHash" in result.data, false);
});

test("contacts require usable core details and permit optional prose and links to be cleared", () => {
  const result = parseContactSettings(form({ contactIntro: "", officeHours: "", mapUrl: "", facebookUrl: "", officialWebsiteUrl: "" }));
  assert.equal(result.success, true);
  for (const field of ["contactEmail", "contactPhone", "contactAddress"] as const) {
    const invalid = parseContactSettings(form({ [field]: " " }));
    assert.equal(invalid.success, false, field);
    if (!invalid.success) assert.ok(invalid.fieldErrors?.[field]);
  }
  for (const contactEmail of ["wrong", "two@example.test another@example.test", "x@example.test\nBcc:injected@example.test"]) {
    const invalid = parseContactSettings(form({ contactEmail }));
    assert.equal(invalid.success, false, contactEmail);
    if (!invalid.success) assert.ok(invalid.fieldErrors?.contactEmail);
  }
});

test("external site links accept only absolute HTTP(S) URLs without credentials or control characters", () => {
  for (const value of ["https://maps.example.test/Case?x=AbC", "http://example.test/path#view"]) assert.equal(safeExternalUrl(value), value);
  for (const value of [undefined, null, 42, "", "/contact", "//example.test", "https:example.test", "https:////example.test", "javascript:alert(1)", "data:text/html,unsafe", "mailto:x@example.test", "https://user:secret@example.test/path", "https://user@example.test", "https://example.test/\nInjected", "https://example.test/\u200bpath"]) assert.equal(safeExternalUrl(value), "", String(value));
  for (const field of ["mapUrl", "facebookUrl", "officialWebsiteUrl"] as const) {
    const result = parseContactSettings(form({ [field]: "javascript:alert(1)" }));
    assert.equal(result.success, false, field);
    if (!result.success) assert.ok(result.fieldErrors?.[field]);
  }
});

test("all site settings are bounded after sanitization before a database write", () => {
  for (const [field, limit] of Object.entries(siteSettingsLimits)) {
    const parser = ["aboutTitle", "aboutIntro", "mission", "vision"].includes(field) ? parseAboutSettings : parseContactSettings;
    const result = parser(form({ [field]: "x".repeat(limit + 1) }));
    assert.equal(result.success, false, field);
    if (!result.success) assert.ok(result.fieldErrors?.[field as keyof typeof DEFAULT_SITE_SETTINGS], field);
  }
});

test("default public site settings contain only public content and existing contact information", () => {
  assert.deepEqual(Object.keys(DEFAULT_SITE_SETTINGS).sort(), ["aboutTitle", "aboutIntro", "mission", "vision", "contactIntro", "contactEmail", "contactPhone", "contactAddress", "officeHours", "mapUrl", "facebookUrl", "officialWebsiteUrl"].sort());
  assert.match(DEFAULT_SITE_SETTINGS.aboutTitle, /Datamex/);
  assert.ok(DEFAULT_SITE_SETTINGS.aboutIntro);
  assert.ok(DEFAULT_SITE_SETTINGS.contactEmail);
  assert.ok(DEFAULT_SITE_SETTINGS.contactPhone);
  assert.ok(DEFAULT_SITE_SETTINGS.contactAddress);
  assert.equal(DEFAULT_SITE_SETTINGS.mission, "");
  assert.equal(DEFAULT_SITE_SETTINGS.vision, "");
  assert.equal(DEFAULT_SITE_SETTINGS.officeHours, "");
});
