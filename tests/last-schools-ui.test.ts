import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import * as icons from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AdmissionSelect } from "../app/portal/admission/admission-ui";
import { InteractivePortalTable } from "../components/portal/interactive-table";
import * as pageHeaders from "../components/portal/page-header";
import * as sidebar from "../components/ui/sidebar";
import * as collapsible from "../components/ui/collapsible";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import type { LastSchoolFormRecord, LastSchoolFormState, LastSchoolTableRow } from "../lib/last-schools/types";
import { loadPortalFeedback } from "./portal-feedback-harness";

function loadModule(path: string, overrides: Record<string, unknown> = {}) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input },
    "@/components/portal/interactive-table": { InteractivePortalTable },
    "@/components/portal/page-header": pageHeaders,
    "@/lib/generated/prisma/enums": enums, "@/lib/utils": utils,
    "../admission/admission-ui": { AdmissionSelect },
    "@/components/portal/toasts": { useActionToast: () => undefined },
    "next/navigation": { useRouter: () => ({ refresh() {} }) },
    "./actions": { reviewLastSchoolAction: async () => assert.fail("Rendering must not submit") },
    ...overrides,
  };
  const loaded = { exports: {} as Record<string, (...args: never[]) => unknown> };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected last-school UI dependency ${name}`);
    return modules[name];
  } });
  return loaded.exports;
}

function schools(count = 3): LastSchoolTableRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index === 0 ? "9007199254740993" : String(index + 1),
    schoolName: `School ${String(index + 1).padStart(2, "0")}`, shortName: index === 0 ? "S01" : "",
    schoolType: "Public", street: "Main Street", barangay: "Central", city: "Manila", province: "Metro Manila", postalCode: "0100",
    verificationStatus: (["pending", "rejected", "verified"] as const)[index % 3],
    formattedAddress: "Main Street, Central, Manila, Metro Manila", applicationCount: index + 1,
    reviewedAt: index ? "2026-10-16T00:00:00.000Z" : null, createdAt: "2026-10-15T00:00:00.000Z",
  }));
}

test("last-school management uses the shared searchable sortable table and pagination with exact edit IDs", () => {
  const { LastSchoolsTable } = loadModule("../app/portal/last-schools/last-schools-table.tsx") as {
    LastSchoolsTable: React.ComponentType<{ schools: LastSchoolTableRow[] }>;
  };
  const markup = renderToStaticMarkup(React.createElement(LastSchoolsTable, { schools: schools(11) }));
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Search last schools/);
  assert.match(markup, /aria-label="Sort by Admissions ascending"/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /href="\/portal\/last-schools\/9007199254740993\/edit"/);
  assert.doesNotMatch(markup, /href="\/portal\/last-schools\/11\/edit"/);
  for (const status of ["pending", "verified", "rejected"]) assert.ok(markup.includes(`<option value="${status}">`));
  const empty = renderToStaticMarkup(React.createElement(LastSchoolsTable, { schools: [] }));
  assert.match(empty, /No schools added/);
  assert.match(empty, /role="searchbox"/);
  assert.doesNotMatch(empty, /aria-label="Next page"/);
});

test("review actions offer verify/reject for pending suggestions, verify for rejected, and edit for verified schools", () => {
  const { LastSchoolsTable } = loadModule("../app/portal/last-schools/last-schools-table.tsx") as {
    LastSchoolsTable: React.ComponentType<{ schools: LastSchoolTableRow[] }>;
  };
  const markup = renderToStaticMarkup(React.createElement(LastSchoolsTable, { schools: schools() }));
  const pending = markup.match(/<form[^>]*aria-label="Review School 01"[\s\S]*?<\/form>/)?.[0];
  const rejected = markup.match(/<form[^>]*aria-label="Review School 02"[\s\S]*?<\/form>/)?.[0];
  assert.ok(pending); assert.ok(rejected);
  assert.match(pending, /name="schoolId" value="9007199254740993"/);
  assert.doesNotMatch(pending, /name="id"/);
  assert.match(pending, /<button(?=[^>]*name="decision")(?=[^>]*value="verify")[^>]*>/);
  assert.match(pending, /<button(?=[^>]*name="decision")(?=[^>]*value="reject")[^>]*>/);
  assert.match(rejected, /<button(?=[^>]*name="decision")(?=[^>]*value="verify")[^>]*>/);
  assert.doesNotMatch(rejected, /value="reject"/);
  assert.doesNotMatch(markup, /aria-label="Review School 03"/);
  assert.match(markup, /aria-label="Edit School 03"/);
});

test("status changes narrow the rows and reset the shared table's search and pagination", () => {
  let status = "";
  const { LastSchoolsTable } = loadModule("../app/portal/last-schools/last-schools-table.tsx", {
    react: { ...React, useState: () => [status, (value: string) => { status = value; }], useId: () => "school-status" },
  }) as { LastSchoolsTable: (props: { schools: LastSchoolTableRow[] }) => React.ReactElement<{ rows: LastSchoolTableRow[]; searchValue: (row: LastSchoolTableRow) => string }> };
  const data = schools();
  const initial = LastSchoolsTable({ schools: data });
  assert.equal(initial.props.rows.length, 3);
  assert.match(initial.props.searchValue(data[0]), /School 01 S01 Public Main Street/);
  status = "pending";
  const pending = LastSchoolsTable({ schools: data });
  assert.deepEqual(pending.props.rows.map(({ id }) => id), ["9007199254740993"]);
  assert.notEqual(pending.key, initial.key);
  status = "verified";
  const verified = LastSchoolsTable({ schools: data });
  assert.deepEqual(verified.props.rows.map(({ id }) => id), ["3"]);
  assert.notEqual(verified.key, pending.key);
});

function formHarness(props: { mode: "create" } | { mode: "edit"; school: LastSchoolFormRecord }) {
  let state: LastSchoolFormState = { success: false, message: "" }, pending = false;
  const values: unknown[] = [], refs: Array<{ current: unknown }> = [], dependencies: React.DependencyList[] = [];
  let stateSlot = 0, refSlot = 0, effectSlot = 0;
  const effects: Array<() => unknown> = [], events: string[] = [];
  const inputs = new Map<string, React.ComponentProps<typeof Input>>();
  const router = { push: (url: string) => events.push(url), refresh: () => events.push("refresh") };
  const hooks = { ...React,
    useState: (initial: unknown) => {
      const index = stateSlot++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (update: unknown) => { values[index] = typeof update === "function" ? update(values[index]) : update; }];
    },
    useActionState: () => [state, async () => assert.fail("Rendering must not submit"), pending],
    useRef: (initial: unknown) => { const index = refSlot++; return refs[index] ??= { current: initial }; },
    useEffect: (effect: () => unknown, next: React.DependencyList) => {
      const index = effectSlot++;
      if (!dependencies[index] || next.some((value, slot) => !Object.is(value, dependencies[index][slot]))) effects.push(effect);
      dependencies[index] = next;
    },
  };
  const { LastSchoolForm } = loadModule("../app/portal/last-schools/school-form.tsx", {
    react: hooks, "./actions": { saveLastSchoolAction: async () => assert.fail("Rendering must not submit") },
    "@/components/ui/input": { Input: (props: React.ComponentProps<typeof Input>) => { inputs.set(String(props.name), props); return React.createElement(Input, props); } },
    "@/components/portal/toasts": loadPortalFeedback(hooks, router, (message) => events.push(`toast:${message}`)),
  }) as { LastSchoolForm: (props: unknown) => React.ReactElement };
  return {
    events,
    render(next = state, saving = false) { stateSlot = 0; refSlot = 0; effectSlot = 0; state = next; pending = saving; return renderToStaticMarkup(LastSchoolForm(props)); },
    flush() { for (const effect of effects.splice(0)) effect(); },
    change(name: string, value: string) { inputs.get(name)?.onChange?.({ target: { value } } as React.ChangeEvent<HTMLInputElement>); },
    blur(name: string, value: string) { inputs.get(name)?.onBlur?.({ currentTarget: { value } } as React.FocusEvent<HTMLInputElement>); },
  };
}

test("school creation requires school identity and locality, makes a verified record, and omits hidden legacy fields", () => {
  const h = formHarness({ mode: "create" });
  const markup = h.render();
  for (const name of ["schoolName", "barangay", "city", "province"]) assert.match(markup, new RegExp(`<input(?=[^>]*name="${name}")(?=[^>]*required="")[^>]*>`));
  assert.match(markup, /<select(?=[^>]*name="schoolType")(?=[^>]*required="")[^>]*>/);
  for (const type of Object.values(enums.SchoolType)) assert.ok(markup.includes(`value="${type}"`));
  assert.match(markup, /<button(?=[^>]*name="intent")(?=[^>]*value="verify")[^>]*>/);
  assert.match(markup, /Add verified school/);
  assert.doesNotMatch(markup, /name="id"|name="schoolId"|name="houseNumber"|name="subdivision"/);
  assert.match(markup, /href="\/portal\/last-schools">Cancel/);
});

test("editing a suggestion supports saving its status separately from verifying and preserves drafts after errors", () => {
  const h = formHarness({ mode: "edit", school: schools()[0] });
  let markup = h.render(); h.flush();
  assert.match(markup, /name="schoolId" value="9007199254740993"/);
  assert.doesNotMatch(markup, /name="id"/);
  assert.match(markup, /<button(?=[^>]*name="intent")(?=[^>]*value="save")[^>]*>/);
  assert.match(markup, /<button(?=[^>]*name="intent")(?=[^>]*value="verify")[^>]*>/);
  h.change("schoolName", "draft school");
  h.blur("schoolName", "  draft school  ");
  markup = h.render({ success: false, message: "Check details.", fieldErrors: { schoolName: "School already exists." } }, true); h.flush();
  assert.match(markup, /value="Draft School"/);
  assert.match(markup, /aria-describedby="last-school-schoolName-error"/);
  assert.match(markup, /School already exists\./);
  assert.match(markup, /<fieldset disabled=""/);
  assert.deepEqual(h.events, ["toast:Check details."]);
  h.events.length = 0;
  h.render({ success: true, message: "School saved." }); h.flush();
  assert.deepEqual(h.events, ["toast:School saved.", "/portal/last-schools", "refresh"]);
  const verified = formHarness({ mode: "edit", school: schools()[2] }).render();
  assert.match(verified, /<button(?=[^>]*name="intent")(?=[^>]*value="save")[^>]*>/);
  assert.doesNotMatch(verified, /<button(?=[^>]*name="intent")(?=[^>]*value="verify")[^>]*>|Save and verify/);
});

test("all school management pages require admin access before loading data or rendering forms", async () => {
  for (const path of ["page.tsx", "new/page.tsx", "[schoolId]/edit/page.tsx"]) {
    const events: string[] = [];
    const modules = {
      "@/lib/auth": { requireAdmin: async () => { events.push("admin"); throw new Error("Admin access required"); } },
      "@/lib/last-schools/admin": { getManagedLastSchools: async () => assert.fail("No unauthorized list"), getManagedLastSchool: async () => assert.fail("No unauthorized school") },
      "./last-schools-table": { LastSchoolsTable: () => assert.fail("No unauthorized table") },
      "../school-form": { LastSchoolForm: () => assert.fail("No unauthorized form") },
      "../../school-form": { LastSchoolForm: () => assert.fail("No unauthorized form") },
    };
    const { default: page } = loadModule(`../app/portal/last-schools/${path}`, modules) as { default: (props: unknown) => Promise<React.ReactElement> };
    await assert.rejects(page({ params: Promise.resolve({ schoolId: "1" }) }), /Admin access required/);
    assert.deepEqual(events, ["admin"]);
  }
});

test("school edit resolves canonical string IDs and rejects invalid or missing records", async () => {
  const read: string[] = [];
  const { default: page } = loadModule("../app/portal/last-schools/[schoolId]/edit/page.tsx", {
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
    "@/lib/auth": { requireAdmin: async () => undefined },
    "@/lib/last-schools/admin": { getManagedLastSchool: async (id: string) => { read.push(id); return id === "9007199254740993" ? schools()[0] : null; } },
    "../../school-form": { LastSchoolForm: ({ school }: { school: LastSchoolFormRecord }) => React.createElement("p", null, school.schoolName) },
  }) as { default: (props: { params: Promise<{ schoolId: string }> }) => Promise<React.ReactElement> };
  for (const schoolId of ["bad", "01", "0", "99999999999999999999", "2"]) await assert.rejects(page({ params: Promise.resolve({ schoolId }) }), /Not found/);
  const markup = renderToStaticMarkup(await page({ params: Promise.resolve({ schoolId: "9007199254740993" }) }));
  assert.deepEqual(read, ["2", "9007199254740993"]);
  assert.match(markup, /School 01/);
  assert.match(markup, /href="\/portal\/last-schools"/);
});

test("management server actions delegate form data to the protected school services", async () => {
  const calls: Array<[string, FormData]> = [];
  const result = { success: true, message: "Saved." };
  const actions = loadModule("../app/portal/last-schools/actions.ts", {
    "@/lib/last-schools/admin": {
      saveManagedLastSchool: async (data: FormData) => { calls.push(["save", data]); return result; },
      reviewManagedLastSchool: async (data: FormData) => { calls.push(["review", data]); return result; },
    },
  }) as { saveLastSchoolAction: (previous: LastSchoolFormState, data: FormData) => Promise<LastSchoolFormState>; reviewLastSchoolAction: (previous: LastSchoolFormState, data: FormData) => Promise<LastSchoolFormState> };
  const data = new FormData(); data.set("schoolId", "9007199254740993");
  assert.equal(await actions.saveLastSchoolAction({ success: false, message: "" }, data), result);
  assert.equal(await actions.reviewLastSchoolAction({ success: false, message: "" }, data), result);
  assert.deepEqual(calls, [["save", data], ["review", data]]);
});

test("Manage Last Schools navigation is available to admin roles and hidden from student and teacher roles", () => {
  const { AppSidebarNav } = loadModule("../components/app-sidebar-nav.tsx", {
    "next/navigation": { usePathname: () => "/portal/last-schools/1/edit" },
    "@/components/ui/sidebar": sidebar, "@/components/ui/collapsible": collapsible,
  }) as { AppSidebarNav: React.ComponentType<{ role: enums.UserRole }> };
  for (const role of Object.values(enums.UserRole)) {
    const markup = renderToStaticMarkup(React.createElement(sidebar.SidebarProvider, null, React.createElement(AppSidebarNav, { role })));
    assert.equal(markup.includes('href="/portal/last-schools"'), role === "admin" || role === "superAdmin", role);
  }
});
