"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { InteractivePortalTable, type InteractiveTableColumn } from "@/components/portal/interactive-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ManagedUser } from "@/lib/users/admin";
import { formatRoleLabel, getInitials } from "@/lib/utils";

const columns: InteractiveTableColumn<ManagedUser>[] = [
  { header: "Photo", cell: (user) => (
    <Avatar className="size-10">
      <AvatarImage src={user.userImage ?? undefined} alt={`Profile photo for ${user.name ?? "user"}`} className="object-cover" />
      <AvatarFallback>{getInitials(user.name ?? "User")}</AvatarFallback>
    </Avatar>
  ) },
  { header: "Name", sortValue: (user) => user.name ?? "", cell: (user) => <span className="font-medium">{user.name ?? "No linked profile"}</span> },
  { header: "Email", sortValue: (user) => user.email, className: "break-all", cell: (user) => <span className="font-medium">{user.email}</span> },
  { header: "Role", sortValue: (user) => formatRoleLabel(user.role), cell: (user) => formatRoleLabel(user.role) },
  { header: "Email verification", sortValue: (user) => user.emailVerified ? "Verified" : "Unverified", cell: (user) => (
    <span className={user.emailVerified ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>{user.emailVerified ? "Verified" : "Unverified"}</span>
  ) },
  { header: "Actions", cell: (user) => (
    <Link href={`/portal/users/${user.id}/edit`} className="inline-flex items-center gap-2 font-medium text-primary hover:underline" aria-label={`Edit user ${user.email}`}>
      <Pencil className="size-4" aria-hidden="true" />Edit
    </Link>
  ) },
];

function searchValue(user: ManagedUser) {
  return [user.name ?? "No linked profile", user.email, formatRoleLabel(user.role), user.emailVerified ? "Verified" : "Unverified"].join(" ");
}

export function UsersTable({ users }: { users: ManagedUser[] }) {
  return (
    <InteractivePortalTable rows={users} columns={columns} rowKey={(user) => user.id} searchValue={searchValue}
      searchLabel="Search users" searchPlaceholder="Search name, email, role, or verification status..."
      initialSort={{ column: "Email", direction: "asc" }} rowLabel="users" emptyTitle="No user accounts found" className="min-w-160"
    />
  );
}
