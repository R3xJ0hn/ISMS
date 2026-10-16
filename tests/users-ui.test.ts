import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { UsersTable } from "../app/portal/users/users-table";
import type { ManagedUser, UserImageFormState } from "../lib/users/admin";
import * as imageValidation from "../lib/users/image";
import * as utils from "../lib/utils";
import { filterTableRows } from "../lib/table";
import type { InteractiveTableColumn } from "../components/portal/interactive-table";
import type * as formModule from "../app/portal/users/user-image-form";
import { loadPortalFeedback } from "./portal-feedback-harness";

const user: ManagedUser = {
  id: "9007199254740993", name: "Maria Santos", email: "teacher@example.test", role: "teacher", emailVerified: true,
  userImage: "https://res.cloudinary.com/synthetic/image/upload/profile.jpg",
  createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z",
};

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;

function native(tag: string) {
  return function Native(props: Props) {
    const attributes = { ...props }; delete attributes.asChild;
    return React.createElement(tag, attributes);
  };
}

function loadModule(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, ...globals, require: (name: string) => {
    assert.ok(name in modules, `Unexpected users UI dependency: ${name}`); return modules[name];
  } });
  return loaded.exports;
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

function imageFormHarness(account = user) {
  let slot = 0, effectSlot = 0, pending = false;
  let state: UserImageFormState = { success: false, message: "" };
  const slots: unknown[] = [], navigation: string[] = [], toasts: string[] = [], revoked: string[] = [];
  const effects: Array<{ dependencies?: unknown[]; cleanup?: () => void }> = [];
  let queued: Array<() => void> = [];
  let created = 0, refreshes = 0;
  const input = { value: "" };
  const resetListeners = new Set<(event: { preventDefault: () => void }) => void>();
  const form = {
    addEventListener: (event: string, handler: (event: { preventDefault: () => void }) => void) => { if (event === "reset") resetListeners.add(handler); },
    removeEventListener: (event: string, handler: (event: { preventDefault: () => void }) => void) => { if (event === "reset") resetListeners.delete(handler); },
  };
  const hooks = {
    ...React,
    useId: () => "profile-image",
    useState: (initial: unknown) => {
      const index = slot++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value: unknown) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef: (initial: unknown) => { const index = slot++; return slots[index] ??= { current: initial }; },
    useActionState: () => [state, () => assert.fail("UI tests must not upload files"), pending],
    useEffect: (effect: () => (() => void) | undefined, dependencies?: unknown[]) => {
      const index = effectSlot++;
      const previous = effects[index];
      if (!previous || !dependencies || dependencies.some((value, position) => !Object.is(value, previous.dependencies?.[position]))) {
        queued.push(() => { previous?.cleanup?.(); effects[index] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  const modules: Record<string, unknown> = {
    react: hooks, "react/jsx-runtime": jsxRuntime, "next/link": { default: native("a") },
    "lucide-react": { Save: () => null, Upload: () => null, X: () => null },
    "@/components/ui/button": { Button: native("button") }, "@/components/ui/input": { Input: native("input") },
    "@/components/ui/avatar": { Avatar: native("div"), AvatarImage: native("img"), AvatarFallback: native("span") },
    "@/lib/utils": utils, "@/lib/users/image": imageValidation,
    "./actions": { updateUserImageAction: () => assert.fail("Rendering must not submit records") },
    "@/components/portal/toasts": loadPortalFeedback(hooks, { push: (url) => navigation.push(url), refresh: () => refreshes++ }, (message) => toasts.push(message)),
  };
  modules["@/components/portal/profile-image-field"] = loadModule("../components/portal/profile-image-field.tsx", modules, {
    URL: { createObjectURL: () => `blob:synthetic-${++created}`, revokeObjectURL: (url: string) => revoked.push(url) },
  });
  const { UserImageForm } = loadModule("../app/portal/users/user-image-form.tsx", modules, {
    URL: { createObjectURL: () => `blob:synthetic-${++created}`, revokeObjectURL: (url: string) => revoked.push(url) },
  }) as typeof formModule;

  return {
    navigation, toasts, revoked, input, resetListeners,
    get refreshes() { return refreshes; },
    setResult(next: UserImageFormState, saving = false) { state = next; pending = saving; },
    unmount() { effects.forEach((effect) => effect.cleanup?.()); },
    render() {
      slot = 0; effectSlot = 0; queued = [];
      const tree = resolve(React.createElement(UserImageForm, { user: account })) as Element;
      for (const element of elements(tree)) {
        const ref = element.props.ref as { current: unknown } | undefined;
        if (ref) ref.current = element.type === "form" ? form : input;
      }
      queued.forEach((effect) => effect());
      return tree;
    },
  };
}

function selectImage(tree: Element, file: { name: string; size: number; type: string }) {
  const control = elements(tree).find(({ props }) => props.name === "image");
  assert.ok(control);
  (control.props.onChange as (event: { target: { files: unknown[] } }) => void)({ target: { files: [file] } });
}

function submit(tree: Element) { return elements(tree).find(({ props }) => props.type === "submit")!; }

test("Manage Users provides search, sorting and pagination without exposing account secrets", () => {
  const users = Array.from({ length: 11 }, (_, index) => ({ ...user, id: String(index + 1), email: `teacher${String(index + 1).padStart(2, "0")}@example.test` }));
  const markup = renderToStaticMarkup(React.createElement(UsersTable, { users }));
  assert.match(markup, /Search users/);
  for (const header of ["Name", "Email", "Role", "Email verification"]) assert.ok(markup.includes(`Sort by ${header} `));
  assert.match(markup, /Maria Santos/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /teacher01@example.test/);
  assert.doesNotMatch(markup, /teacher11@example.test|passwordHash|sessionVersion|Create account/);
  assert.match(markup, /href="\/portal\/users\/1\/edit"/);
});

test("user search considers email, readable role and verification across the entire list", () => {
  const { UsersTable: Table } = loadModule("../app/portal/users/users-table.tsx", {
    "react/jsx-runtime": jsxRuntime, "next/link": { default: native("a") }, "lucide-react": { Pencil: () => null },
    "@/lib/utils": utils, "@/components/ui/avatar": {},
    "@/components/portal/interactive-table": { InteractivePortalTable: () => null },
  }) as { UsersTable: (props: { users: ManagedUser[] }) => React.ReactElement<{ searchValue: (row: ManagedUser) => string; columns: InteractiveTableColumn<ManagedUser>[] }> };
  const users = [user, { ...user, id: "2", email: "pending@example.test", emailVerified: false }];
  const { searchValue } = Table({ users }).props;
  assert.deepEqual(filterTableRows(users, "teacher@example.test teacher verified", searchValue), [user]);
  assert.deepEqual(filterTableRows(users, "pending unverified", searchValue), [users[1]]);
  assert.deepEqual(filterTableRows(users, "maria santos", searchValue), users);
});

test("profile image validation accepts only supported nonempty images up to 5 MiB", () => {
  for (const type of imageValidation.userImageMimeTypes) {
    assert.equal(imageValidation.validateUserImageFile({ type, size: 1 }), null);
    assert.equal(imageValidation.validateUserImageFile({ type, size: imageValidation.userImageMaxBytes }), null);
  }
  for (const size of [0, imageValidation.userImageMaxBytes + 1]) assert.match(imageValidation.validateUserImageFile({ type: "image/png", size })!, /5 MB/);
  for (const type of ["image/svg+xml", "image/gif", "text/html", ""]) assert.match(imageValidation.validateUserImageFile({ type, size: 100 })!, /JPEG, PNG, or WebP/);
});

test("Edit User allows saving immutable account details with or without an existing optional photo", () => {
  for (const userImage of [user.userImage, null]) {
    const harness = imageFormHarness({ ...user, userImage });
    const tree = harness.render();
    assert.equal(submit(tree).props.disabled, false);
    const fields = elements(tree).filter(({ type, props }) => type === "input" && props.name).map(({ props }) => props.name);
    assert.deepEqual(fields, ["userId", "image"]);
    const image = elements(tree).find(({ props }) => props.name === "image")!;
    assert.notEqual(image.props.required, true);
    const markup = renderToStaticMarkup(tree);
    assert.match(markup, /teacher@example.test/);
    assert.match(markup, /Teacher/);
    assert.match(markup, /Verified/);
    assert.match(markup, /Upload photo \(optional\)/);
    assert.match(markup, /accept="image\/jpeg,image\/png,image\/webp"/);
    assert.doesNotMatch(markup, /name="email"|name="role"|name="password"/);
    harness.unmount();
  }
});

test("an optional photo can be cleared and saved without a replacement", () => {
  const harness = imageFormHarness({ ...user, userImage: null });
  let tree = harness.render();
  selectImage(tree, { name: "invalid.svg", size: 100, type: "image/svg+xml" });
  tree = harness.render();
  assert.equal(submit(tree).props.disabled, true);
  const clear = elements(tree).find(({ type, props }) => type === "button" && props.type === "button")!;
  (clear.props.onClick as () => void)();
  tree = harness.render();
  assert.equal(submit(tree).props.disabled, false);
  assert.ok(!elements(tree).some(({ props }) => props.role === "alert"));
  assert.ok(!elements(tree).some(({ props }) => props.name === "removeImage"));
  harness.setResult({ success: true, message: "User details saved." });
  tree = harness.render();
  assert.equal(submit(tree).props.disabled, true);
  assert.deepEqual(harness.navigation, ["/portal/users"]);
  assert.deepEqual(harness.toasts, ["User details saved."]);
  harness.unmount();
});

test("image drafts and previews survive server errors and revoke object URLs when replaced or unmounted", () => {
  const harness = imageFormHarness();
  let tree = harness.render();
  selectImage(tree, { name: "first.png", size: 100, type: "image/png" });
  tree = harness.render();
  assert.equal(submit(tree).props.disabled, false);
  assert.match(renderToStaticMarkup(tree), /blob:synthetic-1/);
  harness.setResult({ success: false, message: "Upload failed", fieldErrors: { image: "Try another image" } });
  tree = harness.render();
  assert.match(renderToStaticMarkup(tree), /first.png/);
  assert.match(renderToStaticMarkup(tree), /Try another image/);
  assert.deepEqual(harness.toasts, ["Upload failed"]);
  let prevented = false;
  for (const listener of harness.resetListeners) listener({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true, "Failed action must retain the browser's selected File");
  selectImage(tree, { name: "replacement.webp", size: 100, type: "image/webp" });
  tree = harness.render();
  assert.deepEqual(harness.revoked, ["blob:synthetic-1"]);
  assert.match(renderToStaticMarkup(tree), /blob:synthetic-2/);
  harness.unmount();
  assert.deepEqual(harness.revoked, ["blob:synthetic-1", "blob:synthetic-2"]);
  assert.equal(harness.resetListeners.size, 0);
});

test("unsupported and oversize files are cleared locally with an accessible error", () => {
  const harness = imageFormHarness();
  let tree = harness.render();
  for (const file of [{ name: "unsafe.svg", size: 100, type: "image/svg+xml" }, { name: "large.png", size: imageValidation.userImageMaxBytes + 1, type: "image/png" }]) {
    harness.input.value = file.name;
    selectImage(tree, file);
    tree = harness.render();
    assert.equal(harness.input.value, "");
    assert.equal(submit(tree).props.disabled, true);
    const input = elements(tree).find(({ props }) => props.name === "image")!;
    assert.equal(input.props["aria-invalid"], true);
    assert.match(String(input.props["aria-describedby"]), /profile-image-error/);
    assert.ok(elements(tree).some(({ props }) => props.role === "alert"));
    assert.doesNotMatch(renderToStaticMarkup(tree), /blob:/);
  }
  harness.unmount();
});

test("removal and file selection are exclusive, pending disables changes, and success returns to users", () => {
  const harness = imageFormHarness();
  let tree = harness.render();
  selectImage(tree, { name: "new.jpg", size: 100, type: "image/jpeg" });
  tree = harness.render();
  const checkbox = elements(tree).find(({ props }) => props.type === "checkbox")!;
  (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
  tree = harness.render();
  assert.ok(elements(tree).some(({ props }) => props.name === "removeImage" && props.value === "true"));
  assert.doesNotMatch(renderToStaticMarkup(tree), /blob:|new.jpg/);
  assert.equal(submit(tree).props.disabled, false);
  selectImage(tree, { name: "new.webp", size: 100, type: "image/webp" });
  tree = harness.render();
  assert.ok(!elements(tree).some(({ props }) => props.name === "removeImage"));
  assert.equal(elements(tree).find(({ props }) => props.type === "checkbox")!.props.checked, false);
  harness.setResult({ success: false, message: "" }, true);
  tree = harness.render();
  assert.equal(elements(tree).find(({ type }) => type === "fieldset")!.props.disabled, true);
  assert.equal(submit(tree).props.disabled, true);
  assert.equal(tree.props["aria-busy"], true);
  harness.setResult({ success: true, message: "Profile photo updated." });
  tree = harness.render();
  harness.render();
  assert.equal(submit(tree).props.disabled, true);
  assert.deepEqual(harness.navigation, ["/portal/users"]);
  assert.equal(harness.refreshes, 1);
  assert.deepEqual(harness.toasts, ["Profile photo updated."]);
  harness.unmount();
});

test("user pages rely on the protected service and return not-found for an unavailable account", async () => {
  const selectedIds: string[] = [];
  let available = true;
  const modules = {
    "react/jsx-runtime": jsxRuntime,
    "@/components/portal/page-header": { PortalFormPage: native("main"), PortalPageHeader: native("section"), PortalCount: () => null },
    "@/lib/users/admin": { getUsers: async () => [user], getUserForEdit: async (id: string) => { selectedIds.push(id); return available ? user : null; } },
    "./users-table": { UsersTable: () => null }, "../../user-image-form": { UserImageForm: () => null },
    "next/navigation": { notFound: () => { throw new Error("Not found"); } },
  };
  const { default: UsersPage } = loadModule("../app/portal/users/page.tsx", modules) as { default: () => Promise<Element> };
  const { default: EditPage } = loadModule("../app/portal/users/[userId]/edit/page.tsx", modules) as { default: (props: { params: Promise<{ userId: string }> }) => Promise<Element> };
  assert.match(renderToStaticMarkup(await UsersPage()), /Manage Users/);
  const page = await EditPage({ params: Promise.resolve({ userId: user.id }) });
  assert.equal(page.props.backHref, "/portal/users");
  assert.match(String(page.props.description), /Maria Santos/);
  assert.deepEqual(selectedIds, [user.id]);
  available = false;
  await assert.rejects(EditPage({ params: Promise.resolve({ userId: "invalid" }) }), /Not found/);
});
