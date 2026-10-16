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
import type { PasswordResetFormState } from "../lib/auth/password-reset-validation";
import type * as forgotForms from "../app/(public)/forgot-password/forgot-password-form";
import type * as resetForms from "../app/(public)/reset-password/reset-password-form";
import type * as forgotPages from "../app/(public)/forgot-password/page";
import type * as resetPages from "../app/(public)/reset-password/page";
import type * as loginForms from "../app/login/login-form";

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
    require: (name: string) => { assert.ok(name in modules, `Unexpected recovery UI dependency: ${name}`); return modules[name]; },
  });
  return loaded.exports;
}

function harness(state: PasswordResetFormState = { success: false, message: "" }, pending = false) {
  const effects: Array<() => unknown> = [];
  const action = async () => assert.fail("Rendering must not send email or change credentials");
  const react = { ...React, useActionState: () => [state, action, pending], useEffect: (effect: () => unknown) => effects.push(effect) };
  const { ForgotPasswordForm } = loadModule("../app/(public)/forgot-password/forgot-password-form.tsx", {
    react, "./actions": { requestPasswordResetAction: action },
  }) as typeof forgotForms;
  const { ResetPasswordForm } = loadModule("../app/(public)/reset-password/reset-password-form.tsx", {
    react, "./actions": { resetPasswordAction: action },
  }) as typeof resetForms;
  return { ForgotPasswordForm, ResetPasswordForm, effects };
}

function input(markup: string, name: string) {
  const control = markup.match(new RegExp(`<input\\b[^>]*name="${name}"[^>]*>`))?.[0];
  assert.ok(control, `Missing ${name} input`);
  return control;
}

test("login provides password recovery and support links without public account registration", () => {
  const { default: LoginForm } = loadModule("../app/login/login-form.tsx", {
    react: { ...React, useActionState: () => [{ status: "idle", message: "", email: "" }, () => {}, false] },
    "./actions": { loginAction: async () => assert.fail("Rendering must not log in") },
  }) as typeof loginForms;
  const markup = renderToStaticMarkup(React.createElement(LoginForm));
  assert.match(markup, /href="\/forgot-password"[^>]*>Forgot password\?/);
  assert.match(markup, /href="mailto:datamex_registrar@stadeline\.edu\.ph"[^>]*>Need help\?/);
  assert.doesNotMatch(markup, /href="\/create-account"|Create account/);
  assert.match(input(markup, "password"), /autoComplete="current-password"/);
});

test("public password recovery requests only an email with accessible labels and the right browser input semantics", () => {
  const { ForgotPasswordForm } = harness();
  const markup = renderToStaticMarkup(React.createElement(ForgotPasswordForm));
  const email = input(markup, "email");
  assert.match(email, /type="email"/);
  assert.match(email, /required=""/);
  assert.match(email, /autoComplete="email"/);
  assert.match(email, /autoCapitalize="none"/);
  assert.match(markup, /for="forgot-password-email"/);
  assert.match(markup, /Send password reset email/);
  assert.match(markup, /href="\/login"/);
  assert.doesNotMatch(markup, /name="role"|name="password"|name="token"/);
});

test("forgot password pending and invalid-email states disable submission and expose field errors", () => {
  const { ForgotPasswordForm } = harness({ success: false, message: "Check the email address.", fieldErrors: { email: "Enter a valid email address." } }, true);
  const markup = renderToStaticMarkup(React.createElement(ForgotPasswordForm));
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /<fieldset disabled=""/);
  assert.match(input(markup, "email"), /aria-invalid="true"/);
  assert.match(input(markup, "email"), /aria-describedby="forgot-password-email-error"/);
  assert.match(markup, /id="forgot-password-email-error"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /<button[^>]*disabled=""/);
  assert.match(markup, /Sending\.\.\./);
});

test("forgot password success renders the backend's generic message without account-specific data", () => {
  const message = "If an account exists for this email address, a reset email will be sent.";
  const { ForgotPasswordForm } = harness({ success: true, message });
  const markup = renderToStaticMarkup(React.createElement(ForgotPasswordForm));
  assert.match(markup, /role="status"/);
  assert.ok(markup.includes(message));
  assert.doesNotMatch(markup, /Teacher|Student|Admin|Account not found/);
});

test("reset password posts a raw hidden token and asks for a password pair with complexity help", () => {
  const { ResetPasswordForm } = harness();
  const token = "signed.Token_Mixed-case";
  const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, { token, record: { email: "user@example.com" } }));
  assert.match(input(markup, "token"), /type="hidden"/);
  assert.ok(input(markup, "token").includes(`value="${token}"`));
  for (const name of ["password", "confirmPassword"]) {
    const control = input(markup, name);
    assert.match(control, /type="password"/);
    assert.match(control, /required=""/);
    assert.match(control, /autoComplete="new-password"/);
    assert.match(control, /autoCapitalize="none"/);
    assert.doesNotMatch(control, /value=/);
  }
  assert.match(input(markup, "password"), /minLength="8"/);
  assert.match(markup, /uppercase and lowercase letters, a number, and a symbol/);
  assert.match(markup, /user@example\.com/);
  assert.doesNotMatch(markup, /name="email"|name="userId"|name="role"/);
});

test("eligible teacher setup previews ask for a first password without posting an account identity or client setup flag", () => {
  const { ResetPasswordForm } = harness();
  const token = "teacher.Setup_Mixed-case";
  const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, {
    token, record: { email: "teacher@example.com", accountSetup: true },
  }));
  assert.match(markup, /Create your password/);
  assert.match(markup, /Choose a password to activate your teacher account/);
  assert.match(markup, /Create password/);
  assert.match(markup, /teacher@example\.com/);
  assert.ok(input(markup, "token").includes(`value="${token}"`));
  for (const name of ["password", "confirmPassword"]) {
    assert.match(input(markup, name), /type="password"/);
    assert.match(input(markup, name), /autoComplete="new-password"/);
  }
  assert.doesNotMatch(markup, /name="accountSetup"|name="employeeRecordId"|name="userId"|name="role"|name="email"/);
  assert.doesNotMatch(markup, /Choose a new password|Reset the password for your portal account/);
});

test("teacher password setup retains accessible first-password copy while pending or displaying validation failures", () => {
  const { ResetPasswordForm } = harness({ success: false, message: "Check the highlighted fields.", fieldErrors: {
    password: "Use a stronger password.", confirmPassword: "Passwords do not match.",
  } }, true);
  const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, {
    token: "setup-token", record: { email: "teacher@example.com", accountSetup: true },
  }));
  assert.match(markup, /Create your password/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /<fieldset disabled=""/);
  assert.match(markup, /Saving\.\.\./);
  assert.match(markup, /role="alert"/);
  assert.match(input(markup, "password"), /aria-invalid="true"/);
  assert.match(input(markup, "confirmPassword"), /aria-invalid="true"/);
});

test("successful teacher setup confirms the account is ready and offers sign-in without another password form", () => {
  const message = "Your teacher account is ready. Sign in with your email and new password.";
  const { ResetPasswordForm } = harness({ success: true, message });
  const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, {
    token: "used-setup-token", record: { email: "teacher@example.com", accountSetup: true },
  }));
  assert.match(markup, /Teacher account ready/);
  assert.match(markup, /role="status"/);
  assert.ok(markup.includes(message));
  assert.match(markup, /href="\/login"/);
  assert.doesNotMatch(markup, /Password updated|<form|type="password"|type="submit"/);
});

test("reset password pending and field failures are accessible without navigation or a refresh", () => {
  const { ResetPasswordForm, effects } = harness({ success: false, message: "Check the fields.", fieldErrors: {
    token: "Use a current reset link.", password: "Use a stronger password.", confirmPassword: "Passwords do not match.",
  } }, true);
  const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, { token: "token", record: { email: "user@example.com" } }));
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /<fieldset disabled=""/);
  assert.match(input(markup, "password"), /aria-invalid="true"/);
  assert.match(input(markup, "password"), /aria-describedby="reset-password-help reset-password-password-error"/);
  assert.match(input(markup, "confirmPassword"), /aria-describedby="reset-password-confirmPassword-error"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /Use a current reset link/);
  assert.match(markup, /<button[^>]*disabled=""/);
  for (const effect of effects) assert.doesNotThrow(effect);
});

test("reset success remains visible when token consumption makes a later preview unavailable", () => {
  const { ResetPasswordForm, effects } = harness({ success: true, message: "Your password has been reset. Sign in with your new password." });
  for (const record of [{ email: "user@example.com" }, null]) {
    const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, { token: "consumed-token", record }));
    assert.match(markup, /role="status"/);
    assert.match(markup, /Password updated/);
    assert.match(markup, /href="\/login"/);
    assert.doesNotMatch(markup, /type="password"|type="submit"|reset link is unavailable/);
  }
  for (const effect of effects) assert.doesNotThrow(effect);
});

test("unavailable reset records offer recovery and sign-in without a credential form", () => {
  const { ResetPasswordForm } = harness();
  const markup = renderToStaticMarkup(React.createElement(ResetPasswordForm, { token: "unusable-token", record: null }));
  assert.match(markup, /This password reset link is unavailable/);
  assert.match(markup, /expired, was already used, or is no longer valid/);
  assert.match(markup, /href="\/forgot-password"/);
  assert.match(markup, /href="\/login"/);
  assert.doesNotMatch(markup, /<form|name="token"|type="password"/);
});

test("forgot-password page describes saved teacher setup and account recovery with private metadata and a 30-minute expiry", () => {
  const { default: ForgotPasswordPage, metadata } = loadModule("../app/(public)/forgot-password/page.tsx", {
    "./forgot-password-form": { ForgotPasswordForm: () => React.createElement("form", { "data-recovery": true }) },
  }) as typeof forgotPages;
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.robots)), { index: false, follow: false });
  assert.equal(metadata.referrer, "no-referrer");
  const markup = renderToStaticMarkup(React.createElement(ForgotPasswordPage));
  assert.match(markup, /email saved in your Teacher employee record/);
  assert.match(markup, /instructions to set or reset your password/);
  assert.match(markup, /Links expire after 30 minutes/);
  assert.match(markup, /data-recovery="true"/);
});

test("reset page only reads valid-sized string token previews and keeps its client form in a stable position", async () => {
  const calls: string[] = [];
  const previews: Array<{ token: string; record: { email: string } | null }> = [];
  const { default: ResetPasswordPage, metadata } = loadModule("../app/(public)/reset-password/page.tsx", {
    "@/lib/auth/password-reset": { getPasswordResetRecord: async (token: string) => { calls.push(token); return token === "valid" ? { email: "user@example.com" } : null; } },
    "./reset-password-form": { ResetPasswordForm: (props: { token: string; record: { email: string } | null }) => { previews.push(props); return React.createElement("div", { "data-reset-form": true }); } },
  }) as typeof resetPages;
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.robots)), { index: false, follow: false });
  assert.equal(metadata.referrer, "no-referrer");
  for (const token of ["valid", "invalid", undefined, "", ["valid", "invalid"], "a".repeat(4097)]) {
    const markup = renderToStaticMarkup(await ResetPasswordPage({ searchParams: Promise.resolve({ token }) }));
    assert.match(markup, /data-reset-form="true"/);
  }
  assert.deepEqual(calls, ["valid", "invalid"]);
  assert.equal(previews[0].record?.email, "user@example.com");
  assert.equal(previews[1].record, null);
  assert.equal(previews[4].token, "");
});

test("recovery server actions forward exact form data and preserve raw token and password bytes", async () => {
  const calls: Array<{ name: string; previous: PasswordResetFormState; data: FormData }> = [];
  const handler = (name: string) => async (previous: PasswordResetFormState, data: FormData) => { calls.push({ name, previous, data }); return { success: true, message: "Saved." }; };
  const forgot = loadModule("../app/(public)/forgot-password/actions.ts", {
    "@/lib/auth/password-reset": { requestPasswordReset: handler("request") },
  }) as { requestPasswordResetAction: (previous: PasswordResetFormState, data: FormData) => Promise<PasswordResetFormState> };
  const reset = loadModule("../app/(public)/reset-password/actions.ts", {
    "@/lib/auth/password-reset": { resetPassword: handler("reset") },
  }) as { resetPasswordAction: (previous: PasswordResetFormState, data: FormData) => Promise<PasswordResetFormState> };
  const previous = { success: false, message: "" };
  const requestData = new FormData();
  requestData.set("email", " User@Example.COM ");
  const resetData = new FormData();
  resetData.set("token", " Raw.Signature-Value ");
  resetData.set("password", " StrongPassword1! ");
  resetData.set("confirmPassword", " StrongPassword1! ");
  assert.equal((await forgot.requestPasswordResetAction(previous, requestData)).success, true);
  assert.equal((await reset.resetPasswordAction(previous, resetData)).success, true);
  assert.equal(calls[0].data, requestData);
  assert.equal(calls[1].data, resetData);
  assert.equal(calls[1].previous, previous);
  assert.equal(calls[0].data.get("email"), " User@Example.COM ");
  assert.equal(calls[1].data.get("token"), " Raw.Signature-Value ");
  assert.equal(calls[1].data.get("password"), " StrongPassword1! ");
});
