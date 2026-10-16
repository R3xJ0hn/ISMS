import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "../lib/site-settings/defaults";
import * as validation from "../lib/site-settings/validation";
import type * as services from "../lib/site-settings/service";

type Query = { where: { id: number }; select?: Record<string, boolean>; create?: Record<string, unknown>; update?: Partial<PublicSiteSettings> };
const stored: PublicSiteSettings = { ...DEFAULT_SITE_SETTINGS, aboutTitle: "Saved About Title", aboutIntro: "Saved Intro", mission: "Saved Mission", contactEmail: "saved@example.test", contactAddress: "Saved Address", officeHours: "Saved Hours" };
function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...stored, ...values })) data.set(key, value);
  return data;
}

function harness(options: { role?: string; absent?: boolean; readFailure?: boolean; writeFailure?: boolean } = {}) {
  const events: string[] = [], paths: Array<[string, string | undefined]> = [], logs: unknown[][] = [];
  const calls: Array<{ method: "read" | "write"; query: Query }> = [];
  let row: PublicSiteSettings | null = options.absent ? null : structuredClone(stored);
  const modules: Record<string, unknown> = {
    react: { cache: (callback: unknown) => callback },
    "server-only": {},
    "@/lib/auth": { requireAdmin: async () => {
      events.push("authorize");
      if (!["admin", "superAdmin"].includes(options.role ?? "admin")) throw new Error("Access denied");
    } },
    "@/lib/prisma": { prisma: { siteSetting: {
      findUnique: async (query: Query) => {
        events.push("read"); calls.push({ method: "read", query: structuredClone(query) });
        if (options.readFailure) throw new Error("Sensitive database hostname and password");
        if (!row) return null;
        const record: Record<string, unknown> = { ...row, id: 1, createdAt: new Date(), updatedAt: new Date(), passwordHash: "private account field" };
        return query.select ? Object.fromEntries(Object.keys(query.select).map((key) => [key, record[key]])) : record;
      },
      upsert: async (query: Query) => {
        events.push("write"); calls.push({ method: "write", query: structuredClone(query) });
        if (options.writeFailure) throw new Error("Sensitive database hostname and password");
        row = row ? { ...row, ...query.update } : { ...query.create } as PublicSiteSettings;
        return row;
      },
    } } },
    "next/cache": { revalidatePath: (path: string, type?: string) => paths.push([path, type]) },
    "./defaults": { DEFAULT_SITE_SETTINGS },
    "./validation": { ...validation,
      parseAboutSettings: (data: FormData) => { events.push("parse-about"); return validation.parseAboutSettings(data); },
      parseContactSettings: (data: FormData) => { events.push("parse-contact"); return validation.parseContactSettings(data); },
    },
  };
  const source = ts.transpileModule(readFileSync(new URL("../lib/site-settings/service.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, console: { error: (...args: unknown[]) => logs.push(args) },
    require: (name: string) => { assert.ok(name in modules, `Unexpected site settings dependency ${name}`); return modules[name]; } });
  return { service: loaded.exports as typeof services, events, paths, logs, calls, getRow: () => structuredClone(row) };
}

test("site settings management authorizes before validation or querying for every unauthorized role", async () => {
  for (const role of ["student", "teacher", "registrar", "nonTeaching", ""]) {
    for (const operation of ["read", "about", "contact"]) {
      const h = harness({ role });
      await assert.rejects(operation === "read" ? h.service.getSiteSettings() : operation === "about" ? h.service.updateAboutSettings(new FormData()) : h.service.updateContactSettings(new FormData()), /Access denied/);
      assert.deepEqual(h.events, ["authorize"]);
      assert.deepEqual(h.calls, []);
      assert.deepEqual(h.paths, []);
    }
  }
});

test("missing settings reads return defaults without creating a record or exposing user data", async () => {
  for (const operation of ["getSiteSettings", "getPublicSiteSettings"] as const) {
    const h = harness({ absent: true });
    assert.deepEqual(structuredClone(await h.service[operation]()), DEFAULT_SITE_SETTINGS);
    assert.deepEqual(h.calls.map(({ method }) => method), ["read"]);
    assert.deepEqual(h.calls[0].query.where, { id: 1 });
    assert.deepEqual(Object.keys(h.calls[0].query.select ?? {}).sort(), Object.keys(DEFAULT_SITE_SETTINGS).sort());
    assert.deepEqual(h.paths, []);
    if (operation === "getSiteSettings") assert.equal(h.events[0], "authorize");
    else assert.equal(h.events.includes("authorize"), false);
  }
});

test("settings readers expose only the public content fields from a saved singleton", async () => {
  const h = harness();
  const settings = await h.service.getPublicSiteSettings();
  assert.deepEqual(structuredClone(settings), stored);
  assert.deepEqual(Object.keys(settings).sort(), Object.keys(DEFAULT_SITE_SETTINGS).sort());
  assert.equal("passwordHash" in settings, false);
  assert.equal("createdAt" in settings, false);
  assert.equal("id" in settings, false);
});

test("about edits save only about fields and preserve current contact details for both administrator roles", async () => {
  for (const role of ["admin", "superAdmin"]) {
    const h = harness({ role });
    const result = await h.service.updateAboutSettings(form({ aboutTitle: "new school story", aboutIntro: "our new introduction", mission: "", vision: "future learners", contactEmail: "forged@example.test", id: "99", passwordHash: "unused" }));
    assert.equal(result.success, true);
    const write = h.calls.find(({ method }) => method === "write")?.query;
    assert.deepEqual(write?.where, { id: 1 });
    assert.deepEqual(write?.update, { aboutTitle: "New School Story", aboutIntro: "Our New Introduction", mission: "", vision: "Future Learners" });
    assert.equal(h.getRow()?.contactEmail, stored.contactEmail);
    assert.equal(h.getRow()?.officeHours, stored.officeHours);
    assert.deepEqual(h.events.slice(0, 3), ["authorize", "parse-about", "write"]);
    assert.ok(h.paths.some(([path, type]) => path === "/" && type === "layout"));
    assert.ok(h.paths.some(([path]) => path === "/about"));
    assert.ok(h.paths.some(([path]) => path === "/portal/site-settings/about"));
  }
});

test("contact edits update only contact content and preserve concurrent about content", async () => {
  const h = harness();
  const result = await h.service.updateContactSettings(form({ contactEmail: " UPDATE@EXAMPLE.TEST ", contactPhone: "+63 912 345 6789", contactAddress: "new campus address", mapUrl: "", facebookUrl: "", officialWebsiteUrl: "", aboutTitle: "Forged Title" }));
  assert.equal(result.success, true);
  const write = h.calls.find(({ method }) => method === "write")?.query;
  assert.deepEqual(Object.keys(write?.update ?? {}).sort(), ["contactIntro", "contactEmail", "contactPhone", "contactAddress", "officeHours", "mapUrl", "facebookUrl", "officialWebsiteUrl"].sort());
  assert.equal(write?.update?.contactEmail, "update@example.test");
  assert.equal(h.getRow()?.aboutTitle, stored.aboutTitle);
  assert.equal(h.getRow()?.mission, stored.mission);
  assert.equal(h.getRow()?.mapUrl, "");
  assert.ok(h.paths.some(([path]) => path === "/contact"));
  assert.ok(h.paths.some(([path]) => path === "/portal/site-settings/contact"));
});

test("first settings save creates one fully populated singleton with defaults for the untouched section", async () => {
  for (const operation of ["updateAboutSettings", "updateContactSettings"] as const) {
    const h = harness({ absent: true });
    const data = form({ aboutTitle: "new title", contactEmail: "new@example.test" });
    assert.equal((await h.service[operation](data)).success, true);
    const write = h.calls.find(({ method }) => method === "write")?.query;
    assert.equal(write?.create?.id, 1);
    assert.equal(Object.keys(write?.create ?? {}).length, 13);
    if (operation === "updateAboutSettings") assert.equal(write?.create?.contactEmail, DEFAULT_SITE_SETTINGS.contactEmail);
    else assert.equal(write?.create?.aboutTitle, DEFAULT_SITE_SETTINGS.aboutTitle);
    assert.deepEqual(h.calls.map(({ method }) => method), ["write"]);
  }
});

test("malformed settings cannot write or revalidate and database failures return safe retry messages", async () => {
  for (const operation of ["updateAboutSettings", "updateContactSettings"] as const) {
    const invalid = harness();
    assert.equal((await invalid.service[operation](new FormData())).success, false);
    assert.deepEqual(invalid.calls, []);
    assert.deepEqual(invalid.paths, []);
    const failing = harness({ writeFailure: true });
    assert.equal((await failing.service[operation](form())).success, false);
    assert.deepEqual(failing.paths, []);
    assert.deepEqual(failing.getRow(), stored);
    assert.doesNotMatch(JSON.stringify(failing.logs), /Sensitive|hostname|password/);
  }
});

test("unavailable public settings fall back to known public defaults without leaking database errors", async () => {
  const h = harness({ readFailure: true });
  assert.deepEqual(structuredClone(await h.service.getPublicSiteSettings()), DEFAULT_SITE_SETTINGS);
  assert.doesNotMatch(JSON.stringify(h.logs), /Sensitive|hostname|password/);
  assert.deepEqual(h.calls.map(({ method }) => method), ["read"]);
});
