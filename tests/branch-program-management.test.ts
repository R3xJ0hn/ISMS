import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as utils from "../lib/utils";
import * as enums from "../lib/generated/prisma/enums";
import * as validation from "../lib/branch-programs/validation";
import type * as services from "../lib/branch-programs/admin";
import type * as formModule from "../components/portal/assignment-form";
import { loadPortalFeedback } from "./portal-feedback-harness";

const branchId = 9007199254740993n;
const firstProgramId = 9007199254740995n;
const secondProgramId = 9007199254740997n;
const initialState = { success: false, message: "" };
const programs = [
  { id: firstProgramId, code: "SYN-IT", label: "Synthetic Information Technology", programType: "Bachelor" as const },
  { id: secondProgramId, code: "SYN-SHS", label: "Synthetic Senior High", programType: "SeniorHigh" as const },
];

function load(path: string, modules: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  }, console: { error: () => undefined } });
  return loaded.exports;
}

function form(ids: string[] = [firstProgramId.toString()], id = branchId.toString()) {
  const data = new FormData();
  data.set("branchId", id);
  data.append("programIds", "");
  for (const programId of ids) data.append("programIds", programId);
  return data;
}

class DatabaseError extends Error {
  constructor(public code: string) { super("Synthetic private database details"); }
}

type Offering = { branchId: bigint; programId: bigint };
type Query = { where?: { id?: bigint | { in: bigint[] }; branchId?: bigint }; select?: Record<string, unknown>; data?: Offering[] };

function serviceHarness(options: { role?: string; missingBranch?: boolean; missingProgram?: boolean; createError?: string } = {}) {
  const events: string[] = [], revalidated: string[] = [];
  const calls: Array<{ method: string; query: Query }> = [];
  const offerings: Offering[] = [{ branchId, programId: firstProgramId }, { branchId: 2n, programId: firstProgramId }];
  const branchRecord = { id: branchId, title: "Synthetic Branch", slug: "synthetic-branch" };
  const record = (method: string, query: Query) => calls.push({ method, query: structuredClone(query) });
  const branch = {
    async findMany(query: Query) {
      record("branch.findMany", query);
      return [{ ...branchRecord, branchPrograms: [{ program: programs[0] }] }];
    },
    async findUnique(query: Query) {
      record("branch.findUnique", query);
      return options.missingBranch || query.where?.id !== branchId ? null : {
        ...branchRecord, branchPrograms: offerings.filter((row) => row.branchId === branchId).map(({ programId }) => ({ programId })),
      };
    },
  };
  const program = { async findMany(query: Query) {
    record("program.findMany", query);
    const ids = typeof query.where?.id === "object" ? query.where.id.in : null;
    return programs.filter((row) => (!ids || ids.includes(row.id)) && (!options.missingProgram || row.id !== secondProgramId));
  } };
  const branchProgram = {
    async deleteMany(query: Query) {
      record("branchProgram.deleteMany", query);
      for (let index = offerings.length - 1; index >= 0; index--) if (offerings[index].branchId === query.where?.branchId) offerings.splice(index, 1);
    },
    async createMany(query: Query) {
      record("branchProgram.createMany", query);
      if (options.createError) throw options.createError === "unexpected" ? new Error("Synthetic private details") : new DatabaseError(options.createError);
      offerings.push(...structuredClone(query.data ?? []));
    },
  };
  const modules: Record<string, unknown> = {
    "@/lib/auth": { requireAdmin: async () => {
      events.push("authorize");
      if (options.role && !["admin", "superAdmin"].includes(options.role)) throw new Error("Access denied");
    } },
    "@/lib/generated/prisma/client": { Prisma: {
      PrismaClientKnownRequestError: DatabaseError, TransactionIsolationLevel: { Serializable: "Serializable" },
    } },
    "@/lib/prisma": { prisma: { branch, program, $transaction: async (
      callback: (tx: { branch: typeof branch; program: typeof program; branchProgram: typeof branchProgram }) => Promise<unknown>,
      transactionOptions: { isolationLevel: string },
    ) => {
      events.push("transaction");
      assert.equal(transactionOptions.isolationLevel, "Serializable");
      const before = structuredClone(offerings);
      try { return await callback({ branch, program, branchProgram }); }
      catch (error) { offerings.splice(0, offerings.length, ...before); throw error; }
    } } },
    "next/cache": { revalidatePath: (path: string) => revalidated.push(path) },
    "./validation": { ...validation, parseBranchProgramForm: (data: FormData) => {
      events.push("parse");
      return validation.parseBranchProgramForm(data);
    } },
  };
  return { service: load("../lib/branch-programs/admin.ts", modules) as typeof services, events, calls, offerings, revalidated };
}

test("branch offerings accept precise PostgreSQL IDs and deduplicate equivalent program selections", () => {
  const result = validation.parseBranchProgramForm(form([firstProgramId.toString(), "0" + firstProgramId.toString(), secondProgramId.toString()]));
  assert.equal(result.success, true);
  if (!result.success) assert.fail("Precise program IDs were rejected");
  assert.equal(result.branchId, branchId);
  assert.deepEqual(result.programIds, [firstProgramId, secondProgramId]);
  assert.equal(validation.parseBranchProgramId("9223372036854775807"), 9223372036854775807n);
  for (const value of ["", "0", "-1", "1.5", "1e2", "+1", "1x", "<b>1</b>", "1\0", "9223372036854775808", "1".repeat(21)]) {
    assert.equal(validation.parseBranchProgramId(value), null, value);
    assert.equal(validation.parseBranchProgramForm(form([value])).success, false, value);
    assert.equal(validation.parseBranchProgramForm(form([], value)).success, false, value);
  }
});

test("clearing branch offerings requires an explicit selection field and rejects files or oversized payloads", () => {
  const empty = validation.parseBranchProgramForm(form([]));
  assert.equal(empty.success, true);
  if (empty.success) assert.deepEqual(empty.programIds, []);
  const missing = form([]); missing.delete("programIds");
  assert.equal(validation.parseBranchProgramForm(missing).success, false);
  const multipleEmpty = form([]); multipleEmpty.append("programIds", "");
  assert.equal(validation.parseBranchProgramForm(multipleEmpty).success, false);
  const file = form([]); file.append("programIds", new Blob(["1"]), "synthetic.txt");
  assert.equal(validation.parseBranchProgramForm(file).success, false);
  assert.equal(validation.parseBranchProgramForm(form(Array(1001).fill("1"))).success, false);
});

test("every branch-program service authorizes before parsing or querying", async () => {
  for (const role of ["teacher", "student", "registrar"]) {
    for (const operation of ["list", "edit", "save"]) {
      const harness = serviceHarness({ role });
      await assert.rejects(operation === "list" ? harness.service.getBranchProgramAssignments()
        : operation === "edit" ? harness.service.getBranchProgramEditData(branchId.toString())
          : harness.service.updateBranchPrograms(initialState, form()), /Access denied/);
      assert.deepEqual(harness.events, ["authorize"]);
      assert.equal(harness.calls.length, 0);
      assert.equal(harness.revalidated.length, 0);
    }
  }
});

test("invalid branch IDs and malformed writes never query the database", async () => {
  const edit = serviceHarness();
  assert.equal(await edit.service.getBranchProgramEditData("9223372036854775808"), null);
  assert.equal(edit.calls.length, 0);
  const save = serviceHarness();
  assert.equal((await save.service.updateBranchPrograms(initialState, form(["bad-id"]))).success, false);
  assert.deepEqual(save.events, ["authorize", "parse"]);
  assert.equal(save.calls.length, 0);
});

test("missing branch or stale program membership cannot delete existing assignments", async () => {
  for (const options of [{ missingBranch: true }, { missingProgram: true }]) {
    const harness = serviceHarness(options);
    const before = structuredClone(harness.offerings);
    const result = await harness.service.updateBranchPrograms(initialState, form([secondProgramId.toString()]));
    assert.equal(result.success, false);
    assert.deepEqual(harness.offerings, before);
    assert.equal(harness.calls.some(({ method }) => method.startsWith("branchProgram.")), false);
    assert.equal(harness.revalidated.length, 0);
    if (options.missingProgram) assert.ok(result.fieldErrors?.programIds);
  }
});

test("admin and superadmin saves replace only their chosen branch in a serializable transaction", async () => {
  for (const role of ["admin", "superAdmin"]) {
    const harness = serviceHarness({ role });
    const data = form([secondProgramId.toString(), secondProgramId.toString()]);
    data.set("role", "superAdmin"); data.set("createdAt", "1900-01-01"); data.set("slug", "forged");
    const result = await harness.service.updateBranchPrograms(initialState, data);
    assert.equal(result.success, true);
    assert.deepEqual(harness.events, ["authorize", "parse", "transaction"]);
    assert.deepEqual(harness.offerings, [{ branchId: 2n, programId: firstProgramId }, { branchId, programId: secondProgramId }]);
    assert.deepEqual(harness.calls.find(({ method }) => method === "branchProgram.deleteMany")?.query, { where: { branchId } });
    assert.deepEqual(harness.calls.find(({ method }) => method === "branchProgram.createMany")?.query, { data: [{ branchId, programId: secondProgramId }] });
    assert.deepEqual(harness.revalidated, ["/admission", "/portal/branch-programs", `/portal/branch-programs/${branchId}/edit`]);
  }
});

test("clear-all removes only selected branch offerings without creating replacement records", async () => {
  const harness = serviceHarness();
  assert.equal((await harness.service.updateBranchPrograms(initialState, form([]))).success, true);
  assert.deepEqual(harness.offerings, [{ branchId: 2n, programId: firstProgramId }]);
  assert.equal(harness.calls.some(({ method }) => method === "branchProgram.createMany"), false);
});

test("replacement failures roll back deleted offerings and return safe retry messages", async () => {
  for (const createError of ["unexpected", "P2034"]) {
    const harness = serviceHarness({ createError });
    const before = structuredClone(harness.offerings);
    const result = await harness.service.updateBranchPrograms(initialState, form([secondProgramId.toString()]));
    assert.equal(result.success, false);
    assert.deepEqual(harness.offerings, before);
    assert.equal(harness.revalidated.length, 0);
    assert.doesNotMatch(result.message, /Synthetic private/);
    if (createError === "P2034") assert.match(result.message, /Another administrator/);
  }
});

test("management readers serialize precise IDs and select only branch and program metadata", async () => {
  const harness = serviceHarness();
  const list = await harness.service.getBranchProgramAssignments();
  assert.equal(list[0].id, branchId.toString());
  assert.equal(list[0].programs[0].id, firstProgramId.toString());
  const edit = await harness.service.getBranchProgramEditData(branchId.toString());
  assert.equal(edit?.branch.id, branchId.toString());
  assert.deepEqual(Array.from(edit?.programIds ?? []), [firstProgramId.toString()]);
  assert.equal(edit?.programs[1].id, secondProgramId.toString());
  const listQuery = harness.calls.find(({ method }) => method === "branch.findMany")?.query;
  assert.deepEqual(Object.keys(listQuery?.select ?? {}).sort(), ["branchPrograms", "id", "slug", "title"]);
  const missing = serviceHarness({ missingBranch: true });
  assert.equal(await missing.service.getBranchProgramEditData(branchId.toString()), null);
});

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;

function native(tag: string) {
  return function Native(props: Props) {
    const attributes = { ...props }; delete attributes.asChild; delete attributes.isActive;
    return React.createElement(tag, attributes);
  };
}

function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function resolve(node: React.ReactNode): React.ReactNode {
  if (Array.isArray(node)) return node.map((child, index) => {
    const resolved = resolve(child);
    return React.isValidElement(resolved) ? React.cloneElement(resolved, { key: resolved.key ?? index }) : resolved;
  });
  if (!React.isValidElement<Props>(node)) return node;
  if (typeof node.type === "function") return resolve((node.type as (props: Props) => React.ReactNode)(node.props));
  return React.cloneElement(node, undefined, resolve(node.props.children));
}

async function formHarness() {
  let slot = 0, pending = false;
  let state: validation.BranchProgramFormState = initialState;
  let effects: Array<() => unknown> = [];
  const values: unknown[] = [], navigation: string[] = [];
  const unusedAction = () => assert.fail("Rendering must not submit database records");
  const hooks = { ...React, useId: () => "synthetic-program-search", useState: (initial: unknown) => {
      const index = slot++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next: unknown) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    }, useRef: (initial: unknown) => {
      const index = slot++;
      return values[index] ??= { current: initial };
    }, useActionState: () => [state, unusedAction, pending], useEffect: (effect: () => unknown) => effects.push(effect) };
  const { PortalAssignmentForm } = load("../components/portal/assignment-form.tsx", {
    react: hooks,
    "react/jsx-runtime": jsxRuntime,
    "next/navigation": { useRouter: () => ({ push: (path: string) => navigation.push(path) }) },
    "lucide-react": { Search: () => null, Save: () => null, X: () => null },
    "@/components/ui/button": { Button: native("button") }, "@/components/ui/input": { Input: native("input") },
    "./toasts": loadPortalFeedback(hooks, { push: (path) => navigation.push(path) }),
  }) as typeof formModule;
  const { default: Page } = load("../app/portal/branch-programs/[branchId]/edit/page.tsx", {
    "react/jsx-runtime": jsxRuntime, "next/link": { default: native("a") },
    "next/navigation": { notFound: () => assert.fail("Synthetic branch exists") },
    "lucide-react": { ArrowLeft: () => null }, "@/components/ui/button": { Button: native("button") },
    "@/components/portal/page-header": { PortalFormPage: native("main") },
    "@/components/portal/assignment-form": { PortalAssignmentForm }, "@/lib/utils": utils,
    "@/lib/branch-programs/admin": { getBranchProgramEditData: async () => ({
      branch: { id: branchId.toString(), title: "Synthetic branch" },
      programs: programs.map((program) => ({ ...program, id: program.id.toString() })), programIds: [firstProgramId.toString()],
    }) }, "../../actions": { saveBranchProgramsAction: unusedAction },
  }) as { default: (props: { params: Promise<{ branchId: string }> }) => Promise<React.ReactNode> };
  const pageTree = await Page({ params: Promise.resolve({ branchId: branchId.toString() }) });
  const configuredForm = elements(pageTree).find(({ type }) => type === PortalAssignmentForm);
  assert.ok(configuredForm, "The branch page must configure the shared assignment form");
  return {
    navigation,
    setResult(result: validation.BranchProgramFormState, saving = false) { state = result; pending = saving; },
    flushEffects() { effects.forEach((effect) => effect()); },
    render() {
      slot = 0; effects = [];
      return resolve(configuredForm) as Element;
    },
  };
}

function hiddenForm(tree: Element) {
  const data = new FormData();
  for (const { props } of elements(tree).filter(({ type, props }) => type === "input" && props.type === "hidden")) {
    data.append(String(props.name), String(props.value));
  }
  return data;
}

function clickButton(tree: Element, text: string) {
  const button = elements(tree).find(({ type, props }) => type === "button" && props.children === text);
  assert.ok(button, `Missing ${text} control`);
  (button.props.onClick as () => void)();
}

test("program search preserves selected hidden IDs and saves filtered and visible selections together", async () => {
  const harness = await formHarness();
  let tree = harness.render();
  const search = elements(tree).find(({ props }) => props.role === "searchbox");
  assert.ok(search);
  (search.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "SHS" } });
  tree = harness.render();
  let checkboxes = elements(tree).filter(({ props }) => props.type === "checkbox");
  assert.equal(checkboxes.length, 1);
  assert.equal(checkboxes[0].props.checked, false);
  assert.deepEqual(hiddenForm(tree).getAll("programIds"), ["", firstProgramId.toString()]);
  (checkboxes[0].props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  tree = harness.render();
  assert.match(renderToStaticMarkup(tree), /2 selected/);
  const parsed = validation.parseBranchProgramForm(hiddenForm(tree));
  assert.equal(parsed.success, true);
  if (parsed.success) assert.deepEqual(parsed.programIds, [firstProgramId, secondProgramId]);
  const filteredSearch = elements(tree).find(({ props }) => props.role === "searchbox")!;
  (filteredSearch.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "nothing matches" } });
  tree = harness.render();
  checkboxes = elements(tree).filter(({ props }) => props.type === "checkbox");
  assert.equal(checkboxes.length, 0);
  assert.deepEqual(hiddenForm(tree).getAll("programIds"), ["", firstProgramId.toString(), secondProgramId.toString()]);
  assert.match(renderToStaticMarkup(tree), /Existing selections are kept/);
});

test("clear and select-all controls apply to all programs even when the current filter hides them", async () => {
  const harness = await formHarness();
  let tree = harness.render();
  const search = elements(tree).find(({ props }) => props.role === "searchbox")!;
  (search.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "SHS" } });
  tree = harness.render();
  clickButton(tree, "Select all");
  tree = harness.render();
  assert.deepEqual(hiddenForm(tree).getAll("programIds"), ["", firstProgramId.toString(), secondProgramId.toString()]);
  clickButton(tree, "Clear selections");
  tree = harness.render();
  assert.deepEqual(hiddenForm(tree).getAll("programIds"), [""]);
  assert.match(renderToStaticMarkup(tree), /0 selected/);
});

test("failed saves preserve selections while pending disables controls and success returns to the parent page", async () => {
  const harness = await formHarness();
  let tree = harness.render();
  clickButton(tree, "Select all");
  harness.setResult({ success: false, message: "Synthetic failed save", fieldErrors: { programIds: "Synthetic selection error" } });
  tree = harness.render(); harness.flushEffects();
  assert.deepEqual(hiddenForm(tree).getAll("programIds"), ["", firstProgramId.toString(), secondProgramId.toString()]);
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")?.props.disabled, false);
  assert.match(renderToStaticMarkup(tree), /Synthetic selection error/);
  assert.deepEqual(harness.navigation, []);
  harness.setResult(initialState, true);
  tree = harness.render();
  assert.equal(tree.props["aria-busy"], true);
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")?.props.disabled, true);
  harness.setResult({ success: true, message: "Synthetic saved" });
  tree = harness.render(); harness.flushEffects();
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")?.props.disabled, true);
  assert.deepEqual(harness.navigation, ["/portal/branch-programs"]);
});

test("branch programs and site settings navigation are visible only to admin and superadmin roles", () => {
  const passthrough = native("div");
  const icon = () => null;
  const sidebar = Object.fromEntries(["SidebarGroup", "SidebarGroupContent", "SidebarGroupLabel", "SidebarMenu", "SidebarMenuButton",
    "SidebarMenuItem", "SidebarMenuSub", "SidebarMenuSubButton", "SidebarMenuSubItem"].map((name) => [name, passthrough]));
  const { AppSidebarNav } = load("../components/app-sidebar-nav.tsx", {
    react: { ...React, useState: (initial: unknown) => [initial, () => undefined] }, "react/jsx-runtime": jsxRuntime,
    "next/link": { default: native("a") }, "next/navigation": { usePathname: () => `/portal/branch-programs/${branchId}/edit` },
    "lucide-react": { BookOpen: icon, ClipboardList: icon, GraduationCap: icon, History: icon, Info: icon, Mail: icon, PanelsTopLeft: icon, Settings2: icon, Users: icon },
    "@/components/ui/sidebar": sidebar,
    "@/components/ui/collapsible": { Collapsible: passthrough, CollapsibleContent: passthrough, CollapsibleTrigger: passthrough },
    "@/lib/generated/prisma/enums": enums, "@/lib/utils": utils,
  }) as { AppSidebarNav: React.ComponentType<{ role: enums.UserRole }> };
  for (const role of Object.values(enums.UserRole)) {
    const markup = renderToStaticMarkup(resolve(React.createElement(AppSidebarNav, { role })));
    assert.equal(markup.includes('href="/portal/branch-programs"'), ["admin", "superAdmin"].includes(role), role);
    for (const href of ["/portal/site-settings", "/portal/site-settings/about", "/portal/site-settings/contact"]) {
      assert.equal(markup.includes(`href="${href}"`), ["admin", "superAdmin"].includes(role), `${role} ${href}`);
    }
  }
});
