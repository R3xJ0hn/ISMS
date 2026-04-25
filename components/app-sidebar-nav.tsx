"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  GraduationCap,
  PanelsTopLeft,
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

type SidebarItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

function getSidebarItems(role: UserRoleValue): SidebarItem[] {
  if (role === UserRole.student) {
    return [
      {
        title: "Grades",
        href: "/portal/grades",
        icon: GraduationCap,
      },
    ];
  }

  if (role === UserRole.superAdmin) {
    return [
      {
        title: "Admission",
        href: "/admission",
        icon: ClipboardList,
      },
      {
        title: "Students Enrolled",
        href: "/portal",
        icon: Users,
      },
    ];
  }

  return [
    {
      title: "Portal",
      href: "/portal",
      icon: PanelsTopLeft,
    },
  ];
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebarNav({ role }: { role: UserRoleValue }) {
  const pathname = usePathname();
  const navigationItems = getSidebarItems(role);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigation</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {navigationItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild isActive={isItemActive(pathname, item.href)}>
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
