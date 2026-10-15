"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { EmployeeStatus, type EmployeeRole } from "@/lib/generated/prisma/enums";
import { employeeRoleOptions, formatEmployeeRoleLabel } from "@/lib/employees/roles";

export type EmployeeTableRow = {
  id: string;
  employeeId: string;
  fullName: string;
  emailAddress: string;
  contactNumber: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  dateStarted: string;
};

const dateFormatter = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const columns: InteractiveTableColumn<EmployeeTableRow>[] = [
  { header: "Employee ID", sortValue: (employee) => employee.employeeId, cell: (employee) => employee.employeeId },
  { header: "Name", sortValue: (employee) => employee.fullName, cell: (employee) => <p className="font-semibold">{employee.fullName}</p> },
  { header: "Email", sortValue: (employee) => employee.emailAddress, className: "break-all", cell: (employee) => employee.emailAddress },
  { header: "Contact number", sortValue: (employee) => employee.contactNumber, cell: (employee) => employee.contactNumber },
  { header: "Role", sortValue: (employee) => formatEmployeeRoleLabel(employee.role), cell: (employee) => formatEmployeeRoleLabel(employee.role) },
  { header: "Status", sortValue: (employee) => employee.status, cell: (employee) => employee.status },
  { header: "Date started", sortValue: (employee) => employee.dateStarted, cell: (employee) => dateFormatter.format(new Date(`${employee.dateStarted}T00:00:00Z`)) },
  { header: "Actions", cell: (employee) => (
    <Link href={`/portal/employees/${employee.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit ${employee.fullName}, ${employee.employeeId}`}>
      <Pencil className="size-4" aria-hidden="true" />Edit
    </Link>
  ) },
];

function searchValue(employee: EmployeeTableRow) {
  return [employee.employeeId, employee.fullName, employee.emailAddress, employee.contactNumber,
    formatEmployeeRoleLabel(employee.role), employee.status, employee.dateStarted].join(" ");
}

export function EmployeesTable({ employees }: { employees: EmployeeTableRow[] }) {
  const statusId = useId();
  const roleId = useId();
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const rows = useMemo(() => employees.filter((employee) => (!status || employee.status === status) && (!role || employee.role === role)), [employees, status, role]);
  const selectClassName = "h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <InteractivePortalTable key={`${status}:${role}`} rows={rows} columns={columns} rowKey={(employee) => employee.id} searchValue={searchValue}
      searchLabel="Search employees" searchPlaceholder="Search employee ID, name, email, or contact number..."
      initialSort={{ column: "Name", direction: "asc" }} rowLabel="employees"
      emptyTitle={status || role ? "No employees match these filters" : "No employee records yet"} className="min-w-275"
      toolbarControls={<div role="group" aria-label="Employee filters" className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={statusId} className="text-sm font-medium">Status</label>
          <select id={statusId} value={status} onChange={(event) => setStatus(event.target.value)} className={selectClassName}>
            <option value="">All statuses</option>
            {Object.values(EmployeeStatus).map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={roleId} className="text-sm font-medium">Role</label>
          <select id={roleId} value={role} onChange={(event) => setRole(event.target.value)} className={selectClassName}>
            <option value="">All roles</option>
            {employeeRoleOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>}
    />
  );
}
