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
import { InteractivePortalTable } from "../components/portal/interactive-table";
import * as utils from "../lib/utils";
import type { TeacherFormState } from "../lib/teachers/validation";
import type * as invitationForms from "../app/portal/teachers/teacher-invitation-form";
import type * as activationForms from "../app/(public)/teacher/activate/teacher-activation-form";
import type * as teacherTables from "../app/portal/teachers/teachers-table";
import type * as activationPages from "../app/(public)/teacher/activate/page";

function loadModule(path: string, overrides: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input }, "@/lib/utils": utils,
    ...overrides,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => { assert.ok(name in modules, `Unexpected onboarding dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

function teacher(overrides: Partial<teacherTables.TeacherTableRow> = {}): teacherTables.TeacherTableRow {
  return {
    employeeRecordId: "9007199254740993", employeeId: "EMP-000A", fullName: "Maria Santos",
    emailAddress: "maria@example.com", contactNumber: "09171234567", status: "Regular",
    accountStatus: "Not Activated", invitationCreatedAt: null, ...overrides,
  };
}

const activationRecord = { employeeRecordId: "1", fullName: "Maria Santos", emailAddress: "maria@example.com" };

function formHarness(state: TeacherFormState = { success: false, message: "" }, pending = false) {
  const effects: Array<() => unknown> = [];
  const notifications: Array<{ success: boolean; message: string }> = [];
  const navigation: string[] = [];
  const submitted: FormData[] = [];
  const action = async (_previous: TeacherFormState, formData: FormData) => { submitted.push(formData); return state; };
  const react = { ...React, useActionState: () => [state, action, pending], useEffect: (effect: () => unknown) => effects.push(effect) };
  const router = { push: (path: string) => navigation.push(path), refresh: () => navigation.push("refresh") };
  const { TeacherSetupEmailForm } = loadModule("../app/portal/teachers/teacher-invitation-form.tsx", {
    "@/components/portal/toasts": { useActionToast: (value: { success: boolean; message: string }) => notifications.push(value) },
    react, "next/navigation": { useRouter: () => router }, "./actions": { sendTeacherSetupEmailAction: action },
  }) as typeof invitationForms;
  const { TeacherActivationForm } = loadModule("../app/(public)/teacher/activate/teacher-activation-form.tsx", {
    react, "./actions": { activateTeacherAction: action },
  }) as typeof activationForms;
  return { TeacherSetupEmailForm, TeacherActivationForm, effects, navigation, submitted, notifications };
}

test("teacher account setup uses an email button bound to the saved employee without email or password inputs", () => {
  const { TeacherSetupEmailForm } = formHarness();
  const markup = renderToStaticMarkup(React.createElement(TeacherSetupEmailForm, { teacher: teacher() }));
  assert.match(markup, /type="hidden" name="employeeRecordId" value="9007199254740993"/);
  assert.doesNotMatch(markup, /name="email"|name="emailAddress"|name="password"|name="confirmPassword"/);
  assert.match(markup, /teacher verifies their email and creates their own password/);
  assert.match(markup, /Send account setup email/);
  assert.doesNotMatch(markup, /<select|Invite|invitation|\/portal\/teachers\/new/);
});

test("teacher send and resend controls bind the internal Employee ID and block active/conflicting accounts", () => {
  const { TeacherSetupEmailForm } = formHarness();
  for (const accountStatus of ["Not Activated", "Setup Email Sent", "Setup Expired"] as const) {
    const markup = renderToStaticMarkup(React.createElement(TeacherSetupEmailForm, { teacher: teacher({ accountStatus }), compact: true }));
    assert.match(markup, /type="hidden" name="employeeRecordId" value="9007199254740993"/);
    assert.ok(markup.includes(accountStatus === "Not Activated" ? "Send account setup email" : "Resend setup email"));
    assert.doesNotMatch(markup, /name="email|type="password"/);
  }
  for (const accountStatus of ["Active", "Account Conflict"] as const) {
    const markup = renderToStaticMarkup(React.createElement(TeacherSetupEmailForm, { teacher: teacher({ accountStatus }) }));
    assert.doesNotMatch(markup, /<form|<button/);
  }
  const resigned = renderToStaticMarkup(React.createElement(TeacherSetupEmailForm, { teacher: teacher({ status: "Resigned" }) }));
  assert.match(resigned, /Account setup is unavailable for resigned employees/);
  assert.doesNotMatch(resigned, /<form|<button/);
  const resignedActive = renderToStaticMarkup(React.createElement(TeacherSetupEmailForm, { teacher: teacher({ status: "Resigned", accountStatus: "Active" }) }));
  assert.match(resignedActive, /has activated their portal account/);
});

test("teacher setup email failures remain accessible and pending sends disable the action", () => {
  const harness = formHarness({ success: false, message: "Wait before resending.", fieldErrors: { employeeRecordId: "Choose a teacher." } }, true);
  const markup = renderToStaticMarkup(React.createElement(harness.TeacherSetupEmailForm, { teacher: teacher() }));
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /aria-describedby="[^"]+"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Sending\.\.\./);
  assert.match(markup, /<button[^>]*disabled=""/);
  for (const effect of harness.effects) effect();
  assert.deepEqual(harness.navigation, []);
});

test("teacher setup email success returns to the overview from its page while inline controls stay on the overview", () => {
  for (const compact of [false, true]) {
    const harness = formHarness({ success: true, message: "Account setup email sent." });
    const markup = renderToStaticMarkup(React.createElement(harness.TeacherSetupEmailForm, { teacher: teacher(), compact }));
    assert.doesNotMatch(markup, /role="status"|Account setup email sent\./);
    assert.deepEqual(harness.notifications, [{ success: true, message: "Account setup email sent." }]);
    for (const effect of harness.effects) effect();
    assert.deepEqual(harness.navigation, compact ? ["refresh"] : ["/portal/teachers", "refresh"]);
  }
});

test("teacher overview uses employee profile columns and setup buttons without exposing private profile fields", () => {
  const harness = formHarness();
  const { TeachersTable } = loadModule("../app/portal/teachers/teachers-table.tsx", {
    "@/components/portal/interactive-table": { InteractivePortalTable }, "./teacher-invitation-form": { TeacherSetupEmailForm: harness.TeacherSetupEmailForm },
  }) as typeof teacherTables;
  const teachers = Array.from({ length: 11 }, (_, index) => teacher({ employeeRecordId: String(index + 1), employeeId: `EMP-${index + 1}`, fullName: `Teacher ${String(index + 1).padStart(2, "0")}`, accountStatus: index < 2 ? "Active" : "Not Activated" }));
  teachers[2].status = "Resigned";
  const markup = renderToStaticMarkup(React.createElement(TeachersTable, { teachers }));
  assert.match(markup, /Employee ID/);
  assert.match(markup, /Employee status/);
  assert.match(markup, /Account status/);
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /href="\/portal\/employees\/10\/edit"/);
  assert.doesNotMatch(markup, /href="\/portal\/employees\/11\/edit"/);
  assert.doesNotMatch(markup, /Manage invitation|href="\/portal\/teachers\/[^\"]+"/);
  assert.doesNotMatch(markup, /Birth|Address|TIN|SSS|PhilHealth|Pag-IBIG|type="password"/);
  assert.equal((markup.match(/name="employeeRecordId"/g) ?? []).length, 7);
});

test("public teacher activation requires a password pair and posts the token without changing credential text", () => {
  const { TeacherActivationForm } = formHarness();
  const markup = renderToStaticMarkup(React.createElement(TeacherActivationForm, { token: "signed.invitation-token", record: activationRecord }));
  assert.match(markup, /type="hidden" name="token" value="signed\.invitation-token"/);
  for (const name of ["password", "confirmPassword"]) {
    const control = markup.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0];
    assert.ok(control, name);
    assert.match(control, /type="password"/);
    assert.match(control, /required=""/);
  }
  assert.equal((markup.match(/autoComplete="new-password"/g) ?? []).length, 2);
  assert.doesNotMatch(markup, /name="email|name="employeeRecordId"|value="undefined"/);
  assert.match(markup, /Verify email and activate account/);
});

test("public teacher activation exposes password errors, pending state, and sign-in after success", () => {
  const failing = formHarness({ success: false, message: "Check your password.", fieldErrors: { password: "Use a stronger password.", confirmPassword: "Passwords do not match." } }, true);
  const markup = renderToStaticMarkup(React.createElement(failing.TeacherActivationForm, { token: "token", record: activationRecord }));
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /<fieldset disabled=""/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /teacher-activation-password-error/);
  assert.match(markup, /teacher-activation-confirmPassword-error/);
  assert.match(markup, /role="alert"/);
  const success = formHarness({ success: true, message: "Your teacher account is ready." });
  const successMarkup = renderToStaticMarkup(React.createElement(success.TeacherActivationForm, { token: "token", record: null }));
  assert.match(successMarkup, /role="status"/);
  assert.match(successMarkup, /Your teacher account is ready/);
  assert.match(successMarkup, /href="\/login"/);
  assert.doesNotMatch(successMarkup, /unavailable|type="password"|type="submit"/);
  for (const effect of success.effects) assert.doesNotThrow(effect);
});

test("teacher activation GET previews account setup with privacy metadata and never executes a save", async () => {
  const previews: string[] = [];
  const { TeacherActivationForm } = formHarness();
  const { default: TeacherActivationPage, metadata } = loadModule("../app/(public)/teacher/activate/page.tsx", {
    "@/lib/teachers/activation": { getTeacherActivationRecord: async (token: string) => { previews.push(token); return token === "valid" ? { employeeRecordId: "1", fullName: "Maria Santos", emailAddress: "maria@example.com" } : null; } },
    "./teacher-activation-form": { TeacherActivationForm },
  }) as typeof activationPages;
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.robots)), { index: false, follow: false });
  assert.equal(metadata.referrer, "no-referrer");
  const valid = renderToStaticMarkup(await TeacherActivationPage({ searchParams: Promise.resolve({ token: "valid" }) }));
  assert.match(valid, /Welcome, Maria Santos/);
  assert.match(valid, /maria@example\.com/);
  assert.match(valid, /verify your email and create your teacher account/);
  const invalid = renderToStaticMarkup(await TeacherActivationPage({ searchParams: Promise.resolve({ token: "invalid" }) }));
  assert.match(invalid, /ask your administrator to resend it/);
  assert.match(invalid, /href="\/login"/);
  assert.doesNotMatch(invalid, /href="\/create-account"|Request new setup email|name="token"|type="password"/);
  await TeacherActivationPage({ searchParams: Promise.resolve({ token: ["valid", "invalid"] }) });
  assert.deepEqual(previews, ["valid", "invalid"]);
});

test("activation pages retain successful form state after consumption and isolate state by setup token", async () => {
  const previews: string[] = [];
  const { default: TeacherActivationPage } = loadModule("../app/(public)/teacher/activate/page.tsx", {
    "@/lib/teachers/activation": { getTeacherActivationRecord: async (token: string) => {
      previews.push(token);
      return token === "valid" && previews.length === 1 ? activationRecord : null;
    } },
    "./teacher-activation-form": { TeacherActivationForm: () => React.createElement("div") },
  }) as typeof activationPages;
  const validTree = await TeacherActivationPage({ searchParams: Promise.resolve({ token: "valid" }) });
  const consumedTree = await TeacherActivationPage({ searchParams: Promise.resolve({ token: "valid" }) });
  const otherTree = await TeacherActivationPage({ searchParams: Promise.resolve({ token: "other" }) });
  const validForm = validTree.props.children.props.children[2];
  const consumedForm = consumedTree.props.children.props.children[2];
  const otherForm = otherTree.props.children.props.children[2];
  assert.equal(validForm.type, consumedForm.type);
  assert.equal(validForm.type, otherForm.type);
  assert.equal(validForm.key, "valid");
  assert.equal(consumedForm.key, validForm.key);
  assert.equal(consumedForm.props.record, null);
  assert.equal(otherForm.key, "other");
  assert.equal(otherForm.props.record, null);
  await TeacherActivationPage({ searchParams: Promise.resolve({ token: ["valid", "other"] }) });
  await TeacherActivationPage({ searchParams: Promise.resolve({ token: "a".repeat(4097) }) });
  assert.deepEqual(previews, ["valid", "valid", "other"]);
});

test("onboarding server action wrappers forward exact FormData and state to their backend services", async () => {
  const calls: Array<{ name: string; previous: TeacherFormState; data: FormData }> = [];
  const handler = (name: string) => async (previous: TeacherFormState, data: FormData) => { calls.push({ name, previous, data }); return { success: true, message: "Saved." }; };
  const admin = loadModule("../app/portal/teachers/actions.ts", { "@/lib/teachers/admin": { inviteTeacher: handler("setup") } }) as { sendTeacherSetupEmailAction: (previous: TeacherFormState, data: FormData) => Promise<TeacherFormState> };
  const activation = loadModule("../app/(public)/teacher/activate/actions.ts", { "@/lib/teachers/activation": { activateTeacher: handler("activate") } }) as { activateTeacherAction: (previous: TeacherFormState, data: FormData) => Promise<TeacherFormState> };
  const state = { success: false, message: "" };
  const invitationData = new FormData();
  invitationData.set("employeeRecordId", "9007199254740993");
  const credentialData = new FormData();
  credentialData.set("token", "signed-token");
  credentialData.set("password", " TeacherPassword1! ");
  credentialData.set("confirmPassword", " TeacherPassword1! ");
  await admin.sendTeacherSetupEmailAction(state, invitationData);
  await activation.activateTeacherAction(state, credentialData);
  assert.equal(calls[0].name, "setup");
  assert.equal(calls[0].data, invitationData);
  assert.equal(calls[1].data, credentialData);
  assert.equal(calls[1].previous, state);
  assert.equal(calls[1].data.get("password"), " TeacherPassword1! ");
});
