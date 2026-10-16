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
import * as utils from "../lib/utils";
import { DEFAULT_SITE_SETTINGS, type PublicSiteSettings } from "../lib/site-settings/defaults";
import type { SiteSettingsFormState } from "../lib/site-settings/validation";
import type * as formModule from "../app/portal/site-settings/site-settings-form";
import { loadPortalFeedback } from "./portal-feedback-harness";

type Props = Record<string, unknown> & { children?: React.ReactNode };
type Element = React.ReactElement<Props>;
function elements(node: React.ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

function harness(section: "about" | "contact") {
  const settings: PublicSiteSettings = { ...DEFAULT_SITE_SETTINGS, aboutTitle: "Saved About", aboutIntro: "Saved Introduction", mission: "", vision: "", contactEmail: "saved@example.test" };
  const listeners = new Map<string, (event: { preventDefault: () => void }) => void>();
  const events: string[] = [], effects: Array<() => unknown> = [], cleanup: Array<() => void> = [];
  const dependencies: Array<React.DependencyList> = [];
  const refs: Array<{ current: unknown }> = [];
  let effectSlot = 0, refSlot = 0, values = settings, pending = false;
  let state: SiteSettingsFormState = { success: false, message: "" };
  let selectedAction: unknown;
  const aboutAction = () => assert.fail("Rendering must not invoke about settings writes");
  const contactAction = () => assert.fail("Rendering must not invoke contact settings writes");
  const action = () => assert.fail("Rendering must not submit settings");
  const router = { push: (url: string) => events.push(`navigate:${url}`) };
  const formElement = {
    addEventListener: (type: string, listener: (event: { preventDefault: () => void }) => void) => { events.push(`listen:${type}`); listeners.set(type, listener); },
    removeEventListener: (type: string, listener: unknown) => { assert.equal(listener, listeners.get(type)); events.push(`unlisten:${type}`); listeners.delete(type); },
  };
  const modules: Record<string, unknown> = {
    react: { ...React,
      useState: () => [values, (next: (previous: PublicSiteSettings) => PublicSiteSettings) => { values = next(values); }],
      useRef: (initial: unknown) => { const index = refSlot++; return refs[index] ??= { current: index === 0 ? formElement : initial }; },
      useActionState: (serverAction: unknown) => { selectedAction = serverAction; return [state, action, pending]; },
      useEffect: (effect: () => unknown, nextDependencies: React.DependencyList) => {
        const slot = effectSlot++;
        if (!dependencies[slot] || nextDependencies.some((value, index) => !Object.is(value, dependencies[slot][index]))) effects.push(effect);
        dependencies[slot] = nextDependencies;
      },
    },
    "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "next/navigation": { useRouter: () => router },
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input }, "@/lib/utils": utils,
    "./actions": { saveAboutSettingsAction: aboutAction, saveContactSettingsAction: contactAction },
  };
  modules["@/components/portal/toasts"] = loadPortalFeedback(modules.react as Record<string, unknown>, router, (message) => events.push(`toast:${message}`));
  const code = ts.transpileModule(readFileSync(new URL("../app/portal/site-settings/site-settings-form.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const loaded = { exports: {} };
  runInNewContext(code, { module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected settings form dependency ${name}`); return modules[name]; } });
  const { SiteSettingsForm } = loaded.exports as typeof formModule;
  return {
    events, listeners,
    render(nextState = state, saving = false) {
      effectSlot = 0; refSlot = 0; state = nextState; pending = saving;
      const tree = SiteSettingsForm({ section, settings });
      return { tree, markup: renderToStaticMarkup(tree) };
    },
    flush() { for (const effect of effects.splice(0)) { const returned = effect(); if (typeof returned === "function") cleanup.push(returned as () => void); } },
    change(tree: React.ReactNode, field: keyof PublicSiteSettings, value: string) {
      const control = elements(tree).find(({ props }) => props.name === field);
      assert.ok(control, `Missing settings control ${field}`);
      (control.props.onChange as (event: { target: { name: string; value: string } }) => void)({ target: { name: field, value } });
    },
    chosenAction: () => selectedAction === (section === "about" ? aboutAction : contactAction),
    unmount() { for (const release of cleanup.splice(0)) release(); },
  };
}

test("About Us settings edit only its section, retain optional blanks, and route through the about action", () => {
  const h = harness("about");
  const { markup } = h.render(); h.flush();
  assert.equal(h.chosenAction(), true);
  for (const field of ["aboutTitle", "aboutIntro", "mission", "vision"]) assert.ok(markup.includes(`name="${field}"`));
  for (const field of ["contactEmail", "contactPhone", "contactAddress", "mapUrl", "userId", "passwordHash"]) assert.equal(markup.includes(`name="${field}"`), false);
  assert.match(markup, /<input(?=[^>]*name="aboutTitle")(?=[^>]*required="")[^>]*>/);
  assert.match(markup, /<textarea(?=[^>]*name="aboutIntro")(?=[^>]*required="")[^>]*>/);
  assert.match(markup, /<textarea(?=[^>]*name="mission")[^>]*><\/textarea>/);
  assert.match(markup, /href="\/about" target="_blank" rel="noopener noreferrer"/);
  assert.match(markup, /href="\/portal\/site-settings"/);
  assert.deepEqual(h.events, ["listen:reset"]);
});

test("Contact settings exposes valid semantic email, phone and URL inputs without about or account fields", () => {
  const h = harness("contact");
  const { markup } = h.render(); h.flush();
  assert.equal(h.chosenAction(), true);
  for (const [field, type] of [["contactEmail", "email"], ["contactPhone", "tel"], ["mapUrl", "url"], ["facebookUrl", "url"], ["officialWebsiteUrl", "url"]]) {
    assert.match(markup, new RegExp(`<input(?=[^>]*name="${field}")(?=[^>]*type="${type}")[^>]*>`));
  }
  assert.match(markup, /<textarea(?=[^>]*name="contactAddress")(?=[^>]*required="")[^>]*>/);
  assert.match(markup, /href="\/contact" target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(markup, /name="aboutTitle"|name="userId"|name="passwordHash"/);
});

test("both settings forms preserve changed input and textarea drafts through pending and failed saves", () => {
  for (const section of ["about", "contact"] as const) {
    const h = harness(section);
    const first = h.render(); h.flush();
    const textField = section === "about" ? "aboutTitle" : "contactEmail";
    const proseField = section === "about" ? "aboutIntro" : "contactAddress";
    const textValue = section === "about" ? "Changed School Title" : "draft@example.test";
    const proseValue = "Changed draft\nRetained second line";
    h.change(first.tree, textField, textValue);
    h.change(first.tree, proseField, proseValue);
    h.events.length = 0;
    const pending = h.render(undefined, true); h.flush();
    assert.match(pending.markup, /aria-busy="true"/);
    assert.match(pending.markup, /<fieldset disabled=""/);
    assert.match(pending.markup, /Saving\.\.\./);
    assert.ok(pending.markup.includes(textValue));
    assert.ok(pending.markup.includes(proseValue));
    let prevented = false;
    h.listeners.get("reset")?.({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    const failure = h.render({ success: false, message: "Check the highlighted fields.", fieldErrors: { [textField]: "Correct this setting." } }); h.flush();
    assert.match(failure.markup, /aria-busy="false"/);
    assert.doesNotMatch(failure.markup, /<fieldset disabled=""/);
    assert.ok(failure.markup.includes(textValue));
    assert.ok(failure.markup.includes(proseValue));
    assert.match(failure.markup, new RegExp(`aria-describedby="site-settings-${textField}-error"`));
    assert.match(failure.markup, /aria-invalid="true"/);
    assert.deepEqual(h.events, ["toast:Check the highlighted fields."]);
    h.unmount();
    assert.equal(h.listeners.size, 0);
    assert.equal(h.events.at(-1), "unlisten:reset");
  }
});

test("a successful settings save locks editing and returns to the parent once", () => {
  for (const section of ["about", "contact"] as const) {
    const h = harness(section);
    h.render(); h.flush(); h.events.length = 0;
    const result = { success: true, message: "Site settings updated." };
    const saved = h.render(result); h.flush();
    assert.match(saved.markup, /<fieldset disabled=""/);
    assert.match(saved.markup, /<button(?=[^>]*type="submit")(?=[^>]*disabled="")[^>]*>/);
    assert.deepEqual(h.events, ["toast:Site settings updated.", "navigate:/portal/site-settings"]);
    h.events.length = 0;
    h.render(result); h.flush();
    assert.deepEqual(h.events, []);
  }
});
