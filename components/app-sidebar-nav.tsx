"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Building2,
  ClipboardList,
  GraduationCap,
  History,
  Info,
  LayoutDashboard,
  Mail,
  PanelsTopLeft,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/generated/prisma/enums";
import { isActivePath } from "@/lib/utils";

type SidebarLinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  superAdminOnly?: boolean;
};

type SidebarLinkGroup = {
  title: string;
  items: SidebarLinkItem[];
};

const adminGroups: SidebarLinkGroup[] = [
  {
    title: "Navigation",
    items: [
      { title: "Dashboard", href: "/portal/dashboard", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: "Students",
    items: [
      { title: "Admissions", href: "/portal/admission", icon: ClipboardList },
      { title: "Manage Students", href: "/portal/students", icon: GraduationCap },
      { title: "Manage Last Schools", href: "/portal/last-schools", icon: Building2 },
    ],
  },
  {
    title: "Academics",
    items: [
      { title: "Manage Classes", href: "/portal/classes", icon: ClipboardList, superAdminOnly: true },
      { title: "Manage Programs", href: "/portal/programs", icon: BookOpen, superAdminOnly: true },
      { title: "Manage Subjects", href: "/portal/subjects", icon: BookOpen, superAdminOnly: true },
      { title: "Manage Branch Programs", href: "/portal/branch-programs", icon: Building2 },
    ],
  },
  {
    title: "People & Access",
    items: [
      { title: "Manage Employees", href: "/portal/employees", icon: Users, superAdminOnly: true },
      { title: "Manage Teachers", href: "/portal/teachers", icon: GraduationCap, superAdminOnly: true },
      { title: "Manage Users", href: "/portal/users", icon: Users },
      { title: "Login History", href: "/portal/login-history", icon: History },
    ],
  },
  {
    title: "Website",
    items: [
      { title: "Site Settings", href: "/portal/site-settings", icon: Settings2, exact: true },
      { title: "About Us", href: "/portal/site-settings/about", icon: Info },
      { title: "Contact", href: "/portal/site-settings/contact", icon: Mail },
    ],
  },
];

function getSidebarGroups(role: UserRoleValue): SidebarLinkGroup[] {
  if (role === UserRole.admin || role === UserRole.superAdmin) {
    return adminGroups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.superAdminOnly || role === UserRole.superAdmin),
    }));
  }

  const items: SidebarLinkItem[] = role === UserRole.teacher
    ? [{ title: "My Classes", href: "/portal/my-classes", icon: BookOpen }]
    : role === UserRole.student
      ? [{ title: "Grades", href: "/portal/grades", icon: GraduationCap }]
      : [{ title: "Portal", href: "/portal", icon: PanelsTopLeft }];

  return [{ title: "Navigation", items }];
}

export function AppSidebarNav({ role }: { role: UserRoleValue }) {
  const pathname = usePathname();

  return (
    <>
      {getSidebarGroups(role).map((group) => (
        <SidebarGroup key={group.title}>
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = item.exact ? pathname === item.href : isActivePath(pathname, item.href);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link href={item.href} aria-label={item.title} aria-current={active ? "page" : undefined}>
                        <item.icon aria-hidden="true" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}
