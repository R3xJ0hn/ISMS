"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  GraduationCap,
  History,
  PanelsTopLeft,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

type SidebarLinkItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type SidebarParentItem = {
  title: string;
  icon: LucideIcon;
  children: SidebarLinkItem[];
};

type SidebarItem = SidebarLinkItem | SidebarParentItem;

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
        title: "Login History",
        href: "/portal/login-history",
        icon: History,
      },
      {
        title: "Student",
        icon: Users,
        children: [
          {
            title: "Admission",
            href: "/portal/admission",
            icon: ClipboardList,
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

function hasChildren(item: SidebarItem): item is SidebarParentItem {
  return "children" in item;
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
              {!hasChildren(item) ? (
                <SidebarMenuButton asChild isActive={isItemActive(pathname, item.href)}>
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <Collapsible
                  defaultOpen={item.children.some((child) =>
                    isItemActive(pathname, child.href)
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={item.children.some((child) =>
                        isItemActive(pathname, child.href)
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
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
                  </CollapsibleContent>
                </Collapsible>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
