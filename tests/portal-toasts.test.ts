import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import type * as toasts from "../components/portal/toasts";
import { loadPortalFeedback } from "./portal-feedback-harness";

function harness(available = true) {
  const notifications: Array<{ message: string; variant: string }> = [];
  const effects: Array<() => void> = [];
  const previous = { current: null };
  const notify = (message: string, variant: string) => notifications.push({ message, variant });
  const source = ts.transpileModule(readFileSync(new URL("../components/portal/toasts.tsx", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: { ...React, useContext: () => available ? notify : null, useRef: () => previous, useEffect: (effect: () => void) => effects.push(effect) },
    "react/jsx-runtime": {}, "radix-ui": {}, "lucide-react": {}, "@/lib/utils": {},
    "next/navigation": {},
  };
  const loaded = { exports: {} };
  runInNewContext(source, { module: loaded, exports: loaded.exports, require: (name: string) => {
    assert.ok(name in modules, "Unexpected notification dependency " + name);
    return modules[name];
  } });
  const { useActionToast: actionToast } = loaded.exports as typeof toasts;
  return { notifications, render: (state: { success: boolean; message: string }) => {
    actionToast(state);
    const effect = effects.pop();
    assert.ok(effect);
    return effect;
  } };
}

test("portal notifications ignore initial states and announce an action once across repeated effects and rerenders", () => {
  const subject = harness();
  subject.render({ success: false, message: "" })();
  assert.equal(subject.notifications.length, 0);
  const state = { success: false, message: "Choose a different email address." };
  const effect = subject.render(state);
  effect();
  effect();
  subject.render(state)();
  assert.deepEqual(subject.notifications, [{ message: state.message, variant: "error" }]);
});

test("a repeated submission can announce the same error again and a later success uses the success toast", () => {
  const subject = harness();
  for (let index = 0; index < 2; index++) subject.render({ success: false, message: "Choose a different email address." })();
  subject.render({ success: true, message: "Employee added successfully." })();
  assert.deepEqual(subject.notifications, [
    { message: "Choose a different email address.", variant: "error" },
    { message: "Choose a different email address.", variant: "error" },
    { message: "Employee added successfully.", variant: "success" },
  ]);
});

test("missing portal notification layout fails clearly instead of silently losing action feedback", () => {
  assert.throws(() => harness(false).render({ success: true, message: "Saved." }), /PortalToastProvider/);
});

test("shared form feedback preserves a failed draft and cleans its native reset guard on unmount", () => {
  const target = new EventTarget();
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<() => unknown> = [];
  const events: string[] = [];
  let slot = 0;
  const { usePortalFormFeedback } = loadPortalFeedback({
    useRef: (initial: unknown) => { const index = slot++; return refs[index] ??= { current: initial }; },
    useEffect: (effect: () => unknown) => effects.push(effect),
  }, { push: (url) => events.push(url) }, (message) => events.push(message));
  const ref = usePortalFormFeedback({ success: false, message: "Keep the current draft." }, { returnTo: "/portal/subjects" });
  ref.current = target as HTMLFormElement;
  const cleanups = effects.splice(0).map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === "function");
  const reset = new Event("reset", { cancelable: true });
  assert.equal(target.dispatchEvent(reset), false);
  assert.equal(reset.defaultPrevented, true);
  assert.deepEqual(events, ["Keep the current draft."]);
  for (const cleanup of cleanups) cleanup();
  assert.equal(target.dispatchEvent(new Event("reset", { cancelable: true })), true);
});

test("shared feedback announces before navigating, refreshes only when requested, and completes each result once", () => {
  for (const refresh of [false, true]) {
    const refs: Array<{ current: unknown }> = [];
    const effects: Array<() => unknown> = [];
    const events: string[] = [];
    let slot = 0;
    const { usePortalFormFeedback: renderFeedback } = loadPortalFeedback({
      useRef: (initial: unknown) => { const index = slot++; return refs[index] ??= { current: initial }; },
      useEffect: (effect: () => unknown) => effects.push(effect),
    }, { push: (url) => events.push(url), refresh: () => events.push("refresh") }, (message) => events.push(message));
    const state = { success: true, message: "Saved." };
    function render(result = state) {
      slot = 0;
      renderFeedback(result, { returnTo: "/portal/programs", refresh });
      for (const effect of effects.splice(0)) { effect(); effect(); }
    }
    render();
    assert.deepEqual(events, ["Saved.", "/portal/programs", ...(refresh ? ["refresh"] : [])]);
    events.length = 0;
    render();
    assert.deepEqual(events, [], "Repeated effects and unchanged results must not repeat navigation or notifications");
    render({ ...state });
    assert.deepEqual(events, ["Saved.", "/portal/programs", ...(refresh ? ["refresh"] : [])]);
  }
});
