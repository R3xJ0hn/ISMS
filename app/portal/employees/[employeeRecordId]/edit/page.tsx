import { notFound } from "next/navigation";
import { PortalFormPage } from "@/components/portal/page-header";
import { getEmployeeForEdit } from "@/lib/employees/admin";
import { EmployeeForm } from "../../employee-form";

export default async function EditEmployeePage({ params }: { params: Promise<{ employeeRecordId: string }> }) {
  const employee = await getEmployeeForEdit((await params).employeeRecordId);
  if (!employee) notFound();

  return (
    <PortalFormPage backHref="/portal/employees" backLabel="Back to employees"
      label="Employees" title="Edit employee" description={`Update the employee record for ${employee.fullName}.`}>
      <EmployeeForm mode="edit" employeeRecordId={employee.id} values={employee.values} />
    </PortalFormPage>
  );
}
