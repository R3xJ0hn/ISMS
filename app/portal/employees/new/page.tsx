import { PortalFormPage } from "@/components/portal/page-header";
import { requireSuperAdmin } from "@/lib/auth";
import { EmployeeForm } from "../employee-form";

export default async function NewEmployeePage() {
  await requireSuperAdmin();

  return (
    <PortalFormPage backHref="/portal/employees" backLabel="Back to employees"
      label="Employees" title="Add employee" description="Enter the employee's personal, contact, and employment details.">
      <EmployeeForm mode="create" />
    </PortalFormPage>
  );
}
