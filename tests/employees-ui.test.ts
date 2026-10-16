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
import * as sidebar from "../components/ui/sidebar";
import * as collapsible from "../components/ui/collapsible";
import * as utils from "../lib/utils";
import * as enums from "../lib/generated/prisma/enums";
import * as validation from "../lib/employees/validation";
import * as roles from "../lib/employees/roles";
import { EmployeesTable, type EmployeeTableRow } from "../app/portal/employees/employees-table";
import type * as employeeForm from "../app/portal/employees/employee-form";
import type * as sidebarNav from "../components/app-sidebar-nav";
import { loadPortalFeedback } from "./portal-feedback-harness";

function loadModule(path: string, overrides: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const modules: Record<string, unknown> = {
    "@/components/portal/profile-image-field": { ProfileImageField: () => null },
    react: React, "react/jsx-runtime": jsxRuntime, "next/link": { default: Link }, "lucide-react": icons,
    "@/components/ui/button": { Button }, "@/components/ui/input": { Input },
    "@/lib/utils": utils, "@/lib/generated/prisma/enums": enums,
    "@/lib/employees/validation": validation,
    "@/lib/employees/roles": roles,
    ...overrides,
  };
  const loaded = { exports: {} };
  runInNewContext(code, {
    module: loaded, exports: loaded.exports,
    require: (name: string) => {
      assert.ok(name in modules, `Unexpected UI dependency: ${name}`);
      return modules[name];
    },
  });
  return loaded.exports;
}

function formHarness(state: validation.EmployeeFormState = { success: false, message: "" }, pending = false) {
  const effects: Array<() => unknown> = [];
  const notifications: Array<{ success: boolean; message: string }> = [];
  const navigation: string[] = [];
  const unusedAction = async () => assert.fail("Rendering must not submit an employee record");
  const hooks = { ...React, useActionState: () => [state, unusedAction, pending], useEffect: (effect: () => unknown) => effects.push(effect) };
  const router = { push: (path: string) => navigation.push(path), refresh: () => navigation.push("refresh") };
  const { EmployeeForm } = loadModule("../app/portal/employees/employee-form.tsx", {
    "@/components/portal/toasts": loadPortalFeedback(hooks, router, (message, variant) => notifications.push({ success: variant === "success", message })),
    react: hooks,
    "./actions": { createEmployeeAction: unusedAction, updateEmployeeAction: unusedAction },
  }) as typeof employeeForm;
  return { EmployeeForm, effects, navigation, notifications };
}

function values(): validation.EmployeeFormValues {
  return {
    employeeId: "empAb-0001", firstName: "Maria", lastName: "Santos", middleName: "Reyes", suffix: "Jr.", birthDate: "1998-02-28", placeOfBirth: "Manila",
    gender: "Female", civilStatus: "Single", nationality: "Filipino", address: "12 Main Street",
    contactNumber: "09171234567", emailAddress: "maria@example.com", tin: "001-002-003",
    sssNo: "00-1234567-8", philHealthNo: "001234567890", pagIbigNo: "0012-3456-7890",
    dateStarted: "2026-10-13", role: "teacher", status: "Probationary",
  };
}

function input(markup: string, name: string) {
  const result = markup.match(new RegExp(`<input\\b[^>]*name="${name}"[^>]*>`));
  assert.ok(result, `Missing input ${name}`);
  return result[0];
}

function select(markup: string, name: string) {
  const result = markup.match(new RegExp(`<select\\b[^>]*name="${name}"[^>]*>[\\s\\S]*?</select>`));
  assert.ok(result, `Missing select ${name}`);
  return result[0];
}

test("employee forms expose all fields with enum dropdowns, date inputs, and optional text government identifiers", () => {
  const { EmployeeForm } = formHarness();
  const markup = renderToStaticMarkup(React.createElement(EmployeeForm, { mode: "create" }));
  for (const name of validation.employeeFields) {
    assert.ok(markup.includes(`name="${name}"`), name);
  }
  for (const [name, choices] of [
    ["gender", Object.values(enums.Gender)], ["civilStatus", Object.values(enums.CivilStatus)],
    ["role", Object.values(enums.EmployeeRole)], ["status", Object.values(enums.EmployeeStatus)],
  ] as const) {
    const control = select(markup, name);
    assert.match(control, /required=""/);
    assert.match(control, /value="" selected=""/);
    for (const choice of choices) assert.ok(control.includes(`value="${choice}"`), `${name}: ${choice}`);
  }
  assert.match(select(markup, "role"), />Non-teaching<\/option>/);
  assert.doesNotMatch(select(markup, "role"), /student|superAdmin|Super Admin/);
  for (const name of ["birthDate", "dateStarted"]) assert.match(input(markup, name), /type="date"/);
  for (const name of ["firstName", "lastName"]) assert.match(input(markup, name), /required=""/);
  for (const name of ["middleName", "suffix"]) {
    assert.doesNotMatch(input(markup, name), /required=/);
    assert.match(input(markup, name), /autoCapitalize="words"/);
  }
  assert.doesNotMatch(markup, /name="fullName"/);
  assert.match(input(markup, "emailAddress"), /type="email"/);
  assert.match(input(markup, "contactNumber"), /type="tel"/);
  assert.match(markup, /<textarea[^>]*name="address"[^>]*required=""/);
  for (const name of ["tin", "sssNo", "philHealthNo", "pagIbigNo"]) {
    const control = input(markup, name);
    assert.match(control, /type="text"/);
    assert.doesNotMatch(control, /required=/);
    assert.match(control, /maxLength="100"/);
  }
  assert.doesNotMatch(markup, /name="employeeRecordId"/);
  assert.doesNotMatch(markup, /type="password"/);
  assert.match(markup, /href="\/portal\/employees">Cancel/);
});

test("employee edits preserve the hidden database ID separately from the visible employee code and exact identifier text", () => {
  const { EmployeeForm } = formHarness();
  const markup = renderToStaticMarkup(React.createElement(EmployeeForm, {
    mode: "edit", employeeRecordId: "9007199254740993", values: values(),
  }));
  assert.match(input(markup, "employeeRecordId"), /type="hidden"/);
  assert.match(input(markup, "employeeRecordId"), /value="9007199254740993"/);
  assert.match(input(markup, "employeeId"), /type="text"/);
  assert.match(input(markup, "employeeId"), /value="empAb-0001"/);
  for (const field of ["firstName", "lastName", "middleName", "suffix", "tin", "sssNo", "philHealthNo", "pagIbigNo", "birthDate", "dateStarted"] as const) {
    assert.ok(input(markup, field).includes(`value="${values()[field]}"`), field);
  }
  assert.match(select(markup, "role"), /value="teacher" selected=""/);
  assert.match(select(markup, "status"), /value="Probationary" selected=""/);
});

test("employee validation errors are accessible and pending saves disable every group", () => {
  const { EmployeeForm, effects, navigation } = formHarness({ success: false, message: "Check the fields.", fieldErrors: { firstName: "Enter a name.", employeeRecordId: "Record unavailable." } }, true);
  const markup = renderToStaticMarkup(React.createElement(EmployeeForm, { mode: "edit", employeeRecordId: "1", values: values() }));
  assert.match(markup, /aria-busy="true"/);
  assert.equal((markup.match(/<fieldset disabled=""/g) ?? []).length, 4);
  assert.match(input(markup, "firstName"), /aria-invalid="true"/);
  assert.match(input(markup, "firstName"), /aria-describedby="employee-firstName-error"/);
  assert.match(markup, /id="employee-firstName-error"[^>]*>Enter a name\./);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*>[\s\S]*Saving/);
  for (const effect of effects) effect();
  assert.deepEqual(navigation, []);
});

test("employee records without names expose blank separate fields for editing", () => {
  const { EmployeeForm } = formHarness();
  const markup = renderToStaticMarkup(React.createElement(EmployeeForm, {
    mode: "edit", employeeRecordId: "1",
    values: { ...values(), firstName: "", lastName: "", middleName: "", suffix: "" },
  }));
  assert.match(input(markup, "firstName"), /value=""/);
  assert.match(input(markup, "lastName"), /value=""/);
  assert.match(input(markup, "firstName"), /required=""/);
  assert.match(input(markup, "lastName"), /required=""/);
  assert.doesNotMatch(markup, /name="fullName"|Saved name:/);
});

test("successful employee additions and edits return to the refreshed list with a toast", () => {
  for (const mode of ["create", "edit"] as const) {
    const harness = formHarness({ success: true, message: "Saved." });
    const markup = renderToStaticMarkup(React.createElement(harness.EmployeeForm, mode === "create"
      ? { mode }
      : { mode, employeeRecordId: "1", values: values() }));
    for (const effect of harness.effects) effect();
    assert.deepEqual(harness.navigation, ["/portal/employees", "refresh"]);
    assert.deepEqual(harness.notifications, [{ success: true, message: "Saved." }]);
    assert.doesNotMatch(markup, /role="status"|>Saved\.</);
    assert.match(markup, /<button[^>]*disabled=""/);
  }
});

function employees(count: number): EmployeeTableRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1), employeeId: `EMP-${String(index + 1).padStart(3, "0")}`, fullName: `Employee ${String(index + 1).padStart(3, "0")}`,
    emailAddress: `employee${index + 1}@example.com`, contactNumber: "09171234567",
    role: "teacher", status: index % 2 ? "Probationary" : "Regular", dateStarted: "2026-10-13",
  }));
}

test("employee overview tables provide search, sorting, paging, safe columns, and internal-ID edit links", () => {
  const markup = renderToStaticMarkup(React.createElement(EmployeesTable, { employees: employees(11) }));
  assert.match(markup, /role="searchbox"/);
  assert.match(markup, /Search employees/);
  assert.match(markup, /aria-label="Sort by Employee ID ascending"/);
  assert.match(markup, /Page 1 of 2/);
  assert.match(markup, /href="\/portal\/employees\/10\/edit"/);
  assert.doesNotMatch(markup, /href="\/portal\/employees\/11\/edit"/);
  assert.match(markup, /Oct 13, 2026/);
  for (const status of Object.values(enums.EmployeeStatus)) assert.ok(markup.includes(`<option value="${status}">`));
  for (const role of Object.values(enums.EmployeeRole)) assert.ok(markup.includes(`<option value="${role}">`));
  assert.match(markup, />Non-teaching<\/option>/);
  assert.doesNotMatch(markup, /value="student"|value="superAdmin"|Super Admin/);
  assert.doesNotMatch(markup, /TIN|PhilHealth|Pag-IBIG|Birth|SSS/);
  const emptyMarkup = renderToStaticMarkup(React.createElement(EmployeesTable, { employees: [] }));
  assert.match(emptyMarkup, /No employee records yet/);
  assert.match(emptyMarkup, /role="searchbox"/);
});

test("employee filters narrow overview rows and change the table key to reset pagination", () => {
  const state = ["", ""];
  let stateIndex = 0;
  const { EmployeesTable: FilterTable } = loadModule("../app/portal/employees/employees-table.tsx", {
    react: {
      ...React, useId: () => "filter", useMemo: (callback: () => unknown) => callback(),
      useState: () => {
        const index = stateIndex++;
        return [state[index], (value: string) => { state[index] = value; }];
      },
    },
    "@/components/portal/interactive-table": { InteractivePortalTable: () => null },
  }) as { EmployeesTable: (props: { employees: EmployeeTableRow[] }) => React.ReactElement<{ rows: EmployeeTableRow[]; toolbarControls: React.ReactElement }> };
  const records = employees(3);
  records[2].role = "nonTeaching";
  function renderTree() { stateIndex = 0; return FilterTable({ employees: records }); }
  const initialTable = renderTree();
  assert.equal(initialTable.props.rows.length, 3);
  const filterMarkup = renderToStaticMarkup(initialTable.props.toolbarControls);
  assert.match(filterMarkup, /<label[^>]*>Status<\/label>/);
  assert.match(filterMarkup, /<label[^>]*>Role<\/label>/);
  assert.equal((filterMarkup.match(/<select\b/g) ?? []).length, 2);
  state[0] = "Regular";
  const statusTable = renderTree();
  assert.deepEqual(statusTable.props.rows.map((row) => row.id), ["1", "3"]);
  assert.notEqual(statusTable.key, initialTable.key);
  state[1] = "nonTeaching";
  const roleTable = renderTree();
  assert.deepEqual(roleTable.props.rows.map((row) => row.id), ["3"]);
  assert.notEqual(roleTable.key, statusTable.key);
});

test("Manage Employees appears in the superadmin sidebar and stays hidden for every other role", () => {
  const { AppSidebarNav } = loadModule("../components/app-sidebar-nav.tsx", {
    "next/navigation": { usePathname: () => "/portal/employees/1/edit" },
    "@/components/ui/sidebar": sidebar,
    "@/components/ui/collapsible": collapsible,
  }) as typeof sidebarNav;
  for (const role of Object.values(enums.UserRole)) {
    const markup = renderToStaticMarkup(React.createElement(sidebar.SidebarProvider, null, React.createElement(AppSidebarNav, { role })));
    assert.equal(markup.includes('href="/portal/employees"'), role === "superAdmin", role);
    if (role === "superAdmin") assert.match(markup, /Manage Employees/);
  }
});
