import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { getTeacherEmployees } from "@/lib/teachers/admin";
import { TeachersTable } from "./teachers-table";

export default async function TeachersManagementPage() {
  const teachers = await getTeacherEmployees();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Teachers" description="Send teacher employees an account setup email to verify their email and create their own password.">
        <PortalCount count={teachers.length} label="teachers" />
      </PortalPageHeader>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="Teacher employees">
        <TeachersTable teachers={teachers} />
      </section>
    </main>
  );
}
