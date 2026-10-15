import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { getEmployees } from "@/lib/employees/admin";
import { EmployeesTable } from "./employees-table";

export default async function EmployeesManagementPage() {
  const employees = await getEmployees();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Employees" description="Add employee records and keep their personal, contact, and employment details up to date.">
        <div className="flex flex-wrap items-center gap-3">
          <PortalCount count={employees.length} label="employees" />
          <Button asChild><Link href="/portal/employees/new"><UserPlus aria-hidden="true" />Add employee</Link></Button>
        </div>
      </PortalPageHeader>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Employee records">
        <EmployeesTable employees={employees} />
      </section>
    </main>
  );
}
