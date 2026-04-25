import type { ComponentProps } from "react";
import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/login/actions";
import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { formatRoleLabel } from "@/lib/auth";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type AppSidebarProps = ComponentProps<typeof Sidebar> & {
  session: {
    id: string;
    email: string;
    role: UserRoleValue;
  };
};

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function getDisplayName(email: string, role: UserRoleValue) {
  const emailName = email.split("@")[0]?.trim() ?? "";
  const normalizedEmailName = emailName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim();
  const roleLabel = formatRoleLabel(role);

  if (!normalizedEmailName) {
    return roleLabel;
  }

  if (
    normalizedEmailName.replace(/\s+/g, "").toLowerCase() ===
    roleLabel.replace(/\s+/g, "").toLowerCase()
  ) {
    return roleLabel;
  }

  return toTitleCase(normalizedEmailName.toLowerCase());
}

function formatStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function getInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export async function AppSidebar({ session, ...props }: AppSidebarProps) {
  const userId = /^\d+$/.test(session.id) ? BigInt(session.id) : null;
  const [user, student] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            userImage: true,
          },
        })
      : null,
    session.role === UserRole.student
      ? prisma.student.findUnique({
          where: {
            email: session.email,
          },
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            suffix: true,
          },
        })
      : null,
  ]);

  const displayName = student
    ? formatStudentName(student)
    : getDisplayName(session.email, session.role);
  const initials = getInitials(displayName);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-0 p-0">
        <div className="flex items-center gap-3 px-3 py-4">
          <Avatar size="lg" className="rounded-2xl ring-1 ring-sidebar-border">
            <AvatarImage src={user?.userImage ?? undefined} alt={displayName} />
            <AvatarFallback className="rounded-2xl bg-primary/12 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {displayName}
            </p>
            <p className="truncate text-xs text-sidebar-foreground/70">
              {formatRoleLabel(session.role)}
            </p>
          </div>
        </div>
        <SidebarSeparator />
      </SidebarHeader>
      <SidebarContent>
        <AppSidebarNav role={session.role} />
      </SidebarContent>
      <SidebarFooter>
        <div className="rounded-xl border border-sidebar-border/60 bg-sidebar-accent/30 p-3">
          <p className="truncate text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
            {session.email}
          </p>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-sidebar-primary px-3 text-sm font-medium text-sidebar-primary-foreground transition hover:bg-sidebar-primary/90"
            >
              <LogOut className="size-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
            </button>
          </form>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
