import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import * as enums from "../lib/generated/prisma/enums";
import * as utils from "../lib/utils";
import type * as sidebarModule from "../components/app-sidebar";
import type * as historyModule from "../app/portal/login-history/page";

function loadModule(path: string, overrides: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    react: React,
    "react/jsx-runtime": jsxRuntime,
    "lucide-react": icons,
    "@/lib/utils": utils,
    "@/lib/generated/prisma/enums": enums,
    ...overrides,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded,
    exports: loaded.exports,
    console: { warn: () => {} },
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected visibility dependency: ${name}`);
      return modules[name];
    },
  });
  return loaded.exports;
}

const Container = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);

function sidebarHarness() {
  const navigationRoles: enums.UserRole[] = [];
  const studentQueries: unknown[] = [];
  const userQueries: unknown[] = [];
  const avatarSources: Array<string | undefined> = [];
  const { AppSidebar } = loadModule("../components/app-sidebar.tsx", {
    "@/app/login/actions": { logoutAction: async () => {} },
    "@/components/app-sidebar-nav": { AppSidebarNav: ({ role }: { role: enums.UserRole }) => {
      navigationRoles.push(role);
      return React.createElement("nav", null, role === enums.UserRole.superAdmin ? "Manage Employees" : "Portal");
    } },
    "@/components/ui/avatar": { Avatar: Container, AvatarFallback: Container, AvatarImage: ({ src }: { src?: string }) => {
      avatarSources.push(src);
      return null;
    } },
    "@/components/ui/sidebar": Object.fromEntries([
      "Sidebar", "SidebarContent", "SidebarFooter", "SidebarHeader", "SidebarRail", "SidebarSeparator",
    ].map((name) => [name, Container])),
    "@/lib/prisma": { prisma: {
      user: { findUnique: async (query: unknown) => {
        userQueries.push(query);
        return { userImage: "https://profiles.example.test/private-personal-photo.png" };
      } },
      student: { findUnique: async (query: unknown) => {
        studentQueries.push(query);
        return { firstName: "Ana", middleName: null, lastName: "Cruz", suffix: null };
      } },
    } },
  }) as typeof sidebarModule;
  return { AppSidebar, navigationRoles, studentQueries, userQueries, avatarSources };
}

test("hidden administrator sidebar uses a generic identity without exposing its account email while retaining management permissions", async () => {
  for (const email of ["superAdmin@example.com", "SUPER_ADMIN@example.com", "private.owner@example.com"]) {
    const harness = sidebarHarness();
    const markup = renderToStaticMarkup(await harness.AppSidebar({ session: { id: "1", email, role: enums.UserRole.superAdmin } }));
    assert.match(markup, /Administrator/);
    assert.match(markup, /Manage Employees/);
    assert.doesNotMatch(markup, /Super[ _]?Admin|superAdmin|SUPER_ADMIN|private\.owner|@example\.com/);
    assert.deepEqual(harness.navigationRoles, [enums.UserRole.superAdmin]);
    assert.equal(harness.studentQueries.length, 0);
    assert.equal(harness.userQueries.length, 0, "The hidden account's image is not loaded");
    assert.deepEqual(harness.avatarSources, [undefined]);
  }
});

test("ordinary sidebar identities and student profile names remain available with their original permissions", async () => {
  const student = sidebarHarness();
  const studentMarkup = renderToStaticMarkup(await student.AppSidebar({ session: { id: "2", email: "ana@example.com", role: enums.UserRole.student } }));
  assert.match(studentMarkup, /Ana Cruz/);
  assert.match(studentMarkup, /Student/);
  assert.match(studentMarkup, /ana@example\.com/);
  assert.deepEqual(student.navigationRoles, [enums.UserRole.student]);
  assert.equal(student.studentQueries.length, 1);
  assert.deepEqual(student.avatarSources, ["https://profiles.example.test/private-personal-photo.png"]);
  const teacher = sidebarHarness();
  const teacherMarkup = renderToStaticMarkup(await teacher.AppSidebar({ session: { id: "3", email: "maria.santos@example.com", role: enums.UserRole.teacher } }));
  assert.match(teacherMarkup, /Maria Santos/);
  assert.match(teacherMarkup, /Teacher/);
  assert.match(teacherMarkup, /maria\.santos@example\.com/);
  assert.equal(teacher.studentQueries.length, 0);
  assert.equal(teacher.userQueries.length, 1);
  assert.deepEqual(teacher.avatarSources, ["https://profiles.example.test/private-personal-photo.png"]);
});

type HistoryQuery = {
  where: { role: { not: string }; user: { role: { not: string } }; userId?: bigint };
  take: number;
  orderBy: { createdAt: string };
};

function historyHarness(role: enums.UserRole, id = "3", denied = false) {
  const events: string[] = [];
  const queries: HistoryQuery[] = [];
  const records = [
    { id: 1n, userId: 1n, email: "hidden.owner@example.com", role: "superAdmin", currentRole: "superAdmin" },
    { id: 2n, userId: 2n, email: "formerly.hidden@example.com", role: "superAdmin", currentRole: "admin" },
    { id: 3n, userId: 4n, email: "now.hidden@example.com", role: "admin", currentRole: "superAdmin" },
    { id: 4n, userId: 3n, email: "visible.teacher@example.com", role: "teacher", currentRole: "teacher" },
    { id: 5n, userId: 5n, email: "visible.admin@example.com", role: "admin", currentRole: "admin" },
  ];
  const { default: LoginHistoryPage } = loadModule("../app/portal/login-history/page.tsx", {
    "@/lib/auth": {
      requireSession: async () => { events.push("authorize"); if (denied) throw new Error("Unauthenticated"); return { id, role }; },
      isAdminRole: (value: string) => value === "admin" || value === "superAdmin",
    },
    "next/navigation": { redirect: (path: string) => { throw new Error("Redirect " + path); } },
    "@/lib/prisma": { prisma: { loginHistory: { findMany: async (query: HistoryQuery) => {
      events.push("history query");
      queries.push(query);
      return records.filter((record) => record.role !== query.where.role.not
        && record.currentRole !== query.where.user.role.not
        && (query.where.userId === undefined || record.userId === query.where.userId))
        .slice(0, query.take)
        .map((record) => ({ ...record, createdAt: new Date("2026-10-13T00:00:00Z"), ipAddress: null, userAgent: null }));
    } } } },
  }) as typeof historyModule;
  return { LoginHistoryPage, events, queries };
}

test("both administrator roles hide historical and current hidden administrator identities in the database query before paging", async () => {
  for (const role of [enums.UserRole.admin, enums.UserRole.superAdmin]) {
    const harness = historyHarness(role);
    const markup = renderToStaticMarkup(await harness.LoginHistoryPage());
    assert.deepEqual(harness.events, ["authorize", "history query"]);
    assert.equal(harness.queries[0].where.role.not, "superAdmin");
    assert.equal(harness.queries[0].where.user.role.not, "superAdmin");
    assert.equal(harness.queries[0].where.userId, undefined);
    assert.equal(harness.queries[0].take, 100);
    assert.equal(harness.queries[0].orderBy.createdAt, "desc");
    assert.match(markup, /visible\.teacher@example\.com/);
    assert.match(markup, /visible\.admin@example\.com/);
    assert.doesNotMatch(markup, /hidden\.owner|formerly\.hidden|now\.hidden|Super Admin/);
  }
});

test("ordinary users retain their own history restriction alongside hidden-account filtering", async () => {
  for (const role of [enums.UserRole.teacher, enums.UserRole.registrar, enums.UserRole.student]) {
    const harness = historyHarness(role);
    const markup = renderToStaticMarkup(await harness.LoginHistoryPage());
    assert.equal(harness.queries[0].where.userId, 3n);
    assert.match(markup, /visible\.teacher@example\.com/);
    assert.doesNotMatch(markup, /visible\.admin|hidden\.owner|formerly\.hidden|now\.hidden/);
  }
});

test("login history performs no database read for an unauthenticated or invalid ordinary session", async () => {
  const denied = historyHarness(enums.UserRole.admin, "3", true);
  await assert.rejects(denied.LoginHistoryPage(), /Unauthenticated/);
  assert.deepEqual(denied.events, ["authorize"]);
  const invalid = historyHarness(enums.UserRole.teacher, "invalid");
  await assert.rejects(invalid.LoginHistoryPage(), /Redirect \/login/);
  assert.deepEqual(invalid.events, ["authorize"]);
});
