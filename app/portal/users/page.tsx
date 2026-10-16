import { PortalCount, PortalPageHeader } from "@/components/portal/page-header";
import { getUsers } from "@/lib/users/admin";
import { UsersTable } from "./users-table";

export default async function UsersManagementPage() {
  const users = await getUsers();

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Management" title="Manage Users" description="View portal accounts and update their profile photos.">
        <PortalCount count={users.length} label="users" />
      </PortalPageHeader>
      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label="User accounts">
        <UsersTable users={users} />
      </section>
    </main>
  );
}
