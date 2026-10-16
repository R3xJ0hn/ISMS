import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import Link from "next/link";
import * as radix from "radix-ui";
import * as icons from "lucide-react";
import * as avatar from "../components/ui/avatar";
import * as utils from "../lib/utils";
import * as themes from "../lib/portal/theme";
import { getEmployeeFullName } from "../lib/employees/names";
import type * as shellModule from "../components/classroom/classroom-shell";
import type * as portalModule from "../components/classroom/classroom-portal";
import type * as layoutModule from "../app/portal/layout";

function loadModule(path: string, overrides: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "radix-ui": radix,
    "lucide-react": icons, "@/components/ui/avatar": avatar, "@/lib/utils": utils,
    "@/lib/portal/theme": themes, "@/lib/employees/names": { getEmployeeFullName },
    "@/app/login/actions": { logoutAction: async () => assert.fail("Rendering must not sign out") },
    ...overrides,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, "Unexpected classroom shell dependency: " + name);
      return modules[name];
    },
  });
  return loaded.exports;
}

function renderShell(role: "student" | "teacher", pathname: string) {
  const { ClassroomShell } = loadModule("../components/classroom/classroom-shell.tsx", {
    "next/navigation": { usePathname: () => pathname },
  }) as typeof shellModule;
  const props: shellModule.ClassroomShellProps = {
    role, displayName: "Maria Santos", email: "maria@example.test", avatarUrl: null,
    children: React.createElement("main", null, "Private classroom content"),
  };
  return renderToStaticMarkup(React.createElement(ClassroomShell, props));
}

function activeHref(markup: string, href: string) {
  return (markup.match(/<a\b[^>]*>/g) ?? []).some((tag) => tag.includes(`href="${href}"`) && tag.includes('aria-current="page"'));
}

test("student classroom navigation offers assigned classes, grades, and own information with the nested class active", () => {
  const markup = renderShell("student", "/portal/classroom/7");
  assert.equal(activeHref(markup, "/portal/classroom"), true);
  assert.match(markup, /href="\/portal\/grades"/);
  assert.match(markup, /href="\/portal\/information"/);
  assert.match(markup, /My information/);
  assert.match(markup, /Skip to content/);
  assert.match(markup, /id="classroom-content"/);
  assert.match(markup, /Private classroom content/);
  assert.doesNotMatch(markup, /Manage Employees|Manage Teachers|Manage Students|\/portal\/classes|\/portal\/admission|\/portal\/login-history|Sign-in history|superAdmin/);
});

test("teacher classroom navigation keeps its own assigned-class route and excludes student grades or administrative routes", () => {
  const markup = renderShell("teacher", "/portal/my-classes/7");
  assert.equal(activeHref(markup, "/portal/my-classes"), true);
  assert.match(markup, /Teacher workspace/);
  assert.match(markup, /aria-label="Open account menu"/);
  assert.match(markup, /href="\/portal\/information"/);
  assert.match(markup, /My information/);
  assert.doesNotMatch(markup, /href="\/portal\/grades"|href="\/portal\/classroom"|Manage Employees|\/portal\/classes|\/portal\/login-history|Sign-in history/);
});

test("own information and student semester grade pages activate only their matching navigation link", () => {
  for (const role of ["teacher", "student"] as const) {
    const paths = role === "student" ? ["/portal/grades", "/portal/information"] : ["/portal/information"];
    for (const path of paths) {
      const markup = renderShell(role, path);
      assert.equal((markup.match(/aria-current="page"/g) ?? []).length, 1);
      assert.equal(activeHref(markup, path), true);
      assert.doesNotMatch(markup, /href="\/portal\/login-history"/);
    }
  }
});

const Container = ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => React.createElement("div", { style }, children);

function layoutHarness(role: string, denied = false) {
  const calls: string[] = [];
  const { default: PortalLayout } = loadModule("../app/portal/layout.tsx", {
    "@/lib/auth": { requireSession: async () => { calls.push("authorize"); if (denied) throw new Error("Verified session required"); return { id: "7", email: "person@example.test", role }; } },
    "@/components/classroom/classroom-portal": { ClassroomPortal: ({ children }: { children: React.ReactNode }) => { calls.push("classroom"); return React.createElement("section", { "data-shell": "classroom" }, children); } },
    "@/components/app-sidebar": { AppSidebar: () => { calls.push("management"); return React.createElement("aside", null, "Management navigation"); } },
    "@/components/portal/toasts": { PortalToastProvider: ({ children }: { children: React.ReactNode }) => { calls.push("toasts"); return React.createElement("div", { "data-toast-provider": "" }, children); } },
    "@/components/ui/breadcrumb": Object.fromEntries(["Breadcrumb", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbList"].map((name) => [name, Container])),
    "@/components/ui/separator": { Separator: Container },
    "@/components/ui/sidebar": Object.fromEntries(["SidebarInset", "SidebarProvider", "SidebarTrigger"].map((name) => [name, Container])),
  }) as typeof layoutModule;
  return { PortalLayout, calls };
}

test("only teacher and student roles receive the classroom shell and scoped blue palette with one toast provider", async () => {
  for (const role of ["teacher", "student", "admin", "superAdmin", "registrar"]) {
    const loaded = layoutHarness(role);
    const markup = renderToStaticMarkup(await loaded.PortalLayout({ children: React.createElement("main", null, "Portal content") }));
    const classroom = role === "teacher" || role === "student";
    assert.equal(markup.includes('data-shell="classroom"'), classroom, role);
    assert.equal(markup.includes("--primary:#1967d2"), classroom, role);
    assert.equal(loaded.calls.includes("management"), !classroom, role);
    assert.equal(loaded.calls.filter((call) => call === "toasts").length, 1);
    assert.equal(loaded.calls[0], "authorize");
    assert.match(markup, /Portal content/);
  }
});

test("layout requires a verified session before rendering any role shell or notification provider", async () => {
  const loaded = layoutHarness("student", true);
  await assert.rejects(loaded.PortalLayout({ children: null }), /Verified session required/);
  assert.deepEqual(loaded.calls, ["authorize"]);
});

function profileHarness(role: "teacher" | "student", email = "teacher@example.test", profiles = 1) {
  const queries: Array<{ table: string; where: Record<string, unknown>; select: Record<string, unknown>; take?: number }> = [];
  const employee = { firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null };
  const { ClassroomPortal } = loadModule("../components/classroom/classroom-portal.tsx", {
    "./classroom-shell": { ClassroomShell: () => null },
    "@/lib/prisma": { prisma: {
      user: { findUnique: async (query: typeof queries[number]) => { queries.push({ ...query, table: "user" }); return { userImage: null }; } },
      teacher: { findUnique: async (query: typeof queries[number]) => { queries.push({ ...query, table: "teacher" }); return { employee }; } },
      student: { findMany: async (query: typeof queries[number]) => { queries.push({ ...query, table: "student" }); return Array.from({ length: profiles }, () => employee); } },
    } },
  }) as typeof portalModule;
  return { ClassroomPortal, queries, session: { id: "7", role, email } };
}

test("classroom identity loads the teacher by its current user ID without reading other employee account fields", async () => {
  const loaded = profileHarness("teacher");
  const result = await loaded.ClassroomPortal({ session: loaded.session, children: null });
  assert.equal(result.props.displayName, "Ana Cruz");
  assert.deepEqual(loaded.queries.map((query) => query.table), ["user", "teacher"]);
  const teacher = loaded.queries[1];
  assert.equal(teacher.where.userId, 7n);
  assert.deepEqual(Object.keys((teacher.select.employee as { select: unknown }).select as object).sort(), ["firstName", "lastName", "middleName", "suffix"]);
});

test("student classroom identity uses a literal insensitive email and avoids choosing another ambiguous legacy profile", async () => {
  for (const profiles of [1, 2]) {
    const loaded = profileHarness("student", "Student_%\\Name@Example.test", profiles);
    const result = await loaded.ClassroomPortal({ session: loaded.session, children: null });
    const query = loaded.queries.find((entry) => entry.table === "student")!;
    const email = query.where.email as { equals: string; mode: string };
    assert.equal(email.equals, "student\\_\\%\\\\name@example.test");
    assert.equal(email.mode, "insensitive");
    assert.equal(query.take, 2);
    assert.equal(result.props.displayName === "Ana Cruz", profiles === 1);
    assert.equal(loaded.queries.some((entry) => entry.table === "teacher"), false);
  }
});
