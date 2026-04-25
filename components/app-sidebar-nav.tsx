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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { UserRole, type UserRole as UserRoleValue } from "@/lib/generated/prisma/enums";

type SidebarItem = {
  title: string;
  href?: string;
  icon: LucideIcon;
  children?: {
    title: string;
    href: string;
    icon: LucideIcon;
  }[];
};

function getSidebarItems(role: UserRoleValue): SidebarItem[] {
  if (role === UserRole.student) {
    return [
      {
        title: "Grades",
        href: "/portal",
        icon: GraduationCap,
      },
    ];
  }

  if (role === UserRole.admin || role === UserRole.superAdmin) {
    return [
      {
        title: "Student",
        icon: Users,
        children: [
          {
            title: "Admission",
            href: "/portal/admission",
            icon: ClipboardList,
          },
          {
            title: "Enrolled",
            href: "/portal",
            icon: GraduationCap,
          },
        ],
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
              {item.href ? (
                <SidebarMenuButton asChild isActive={isItemActive(pathname, item.href)}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <>
                  <SidebarMenuButton
                    isActive={item.children?.some((child) =>
                      isItemActive(pathname, child.href)
                    )}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.children ? (
                    <SidebarMenuSub>
                      {item.children.map((child) => (
                        <SidebarMenuSubItem key={child.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={isItemActive(pathname, child.href)}
                          >
                            <Link href={child.href}>
                              <child.icon />
                              <span>{child.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
