"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  History,
  Info,
  Mail,
  PanelsTopLeft,
  Settings2,
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
import { isActivePath } from "@/lib/utils";

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
  if (role === UserRole.teacher) {
    return [
      {
        title: "My Classes",
        href: "/portal/my-classes",
        icon: BookOpen,
      },
    ];
  }

  if (role === UserRole.student) {
    return [
      {
        title: "Grades",
        href: "/portal/grades",
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

function getManagementItems(role: UserRoleValue): SidebarItem[] {
  if (role === UserRole.admin || role === UserRole.superAdmin) {
    return [
      {
        title: "Manage Students",
        icon: Users,
        children: [
          {
            title: "Admission",
            href: "/portal/admission",
            icon: ClipboardList,
          },
          {
            title: "Students",
            href: "/portal/students",
            icon: GraduationCap,
          },
        ],
      },
      { title: "Manage Users", href: "/portal/users", icon: Users },
      { title: "Manage Last Schools", href: "/portal/last-schools", icon: GraduationCap },
      { title: "Manage Branch Programs", href: "/portal/branch-programs", icon: BookOpen },
      ...(role === UserRole.superAdmin ? [
        { title: "Manage Classes", href: "/portal/classes", icon: ClipboardList },
        { title: "Manage Employees", href: "/portal/employees", icon: Users },
        { title: "Manage Teachers", href: "/portal/teachers", icon: Users },
        { title: "Manage Programs", href: "/portal/programs", icon: BookOpen },
        { title: "Manage Subjects", href: "/portal/subjects", icon: BookOpen },
      ] : []),
    ];
  }

  return [];
}

function hasChildren(item: SidebarItem): item is SidebarParentItem {
  return "children" in item;
}

function SidebarParentNavItem({
  item,
  pathname,
}: {
  item: SidebarParentItem;
  pathname: string;
}) {
  const isActiveChild = item.children.some((child) =>
    isActivePath(pathname, child.href)
  );
  const [manuallyOpen, setManuallyOpen] = useState(false);
  const [manuallyClosedPath, setManuallyClosedPath] = useState<string | null>(
    null
  );
  const open =
    (isActiveChild && manuallyClosedPath !== pathname) || manuallyOpen;

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) => {
        setManuallyOpen(nextOpen);
        setManuallyClosedPath(!nextOpen && isActiveChild ? pathname : null);
      }}
    >
      <CollapsibleTrigger asChild>
        <SidebarMenuButton isActive={isActiveChild}>
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
                isActive={isActivePath(pathname, child.href)}
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
  );
}

export function AppSidebarNav({ role }: { role: UserRoleValue }) {
  const pathname = usePathname();
  const navigationItems = getSidebarItems(role);
  const managementItems = getManagementItems(role);
  const canManageSite = role === UserRole.admin || role === UserRole.superAdmin;
  const siteItems = [
    { title: "Overview", href: "/portal/site-settings", icon: Settings2 },
    { title: "About Us", href: "/portal/site-settings/about", icon: Info },
    { title: "Contact", href: "/portal/site-settings/contact", icon: Mail },
  ];

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {navigationItems.map((item) => (
              <SidebarMenuItem key={item.title}>
                {!hasChildren(item) ? (
                  <SidebarMenuButton asChild isActive={isActivePath(pathname, item.href)}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                ) : (
                  <SidebarParentNavItem item={item} pathname={pathname} />
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {managementItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {!hasChildren(item) ? (
                    <SidebarMenuButton asChild isActive={isActivePath(pathname, item.href)}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  ) : (
                    <SidebarParentNavItem item={item} pathname={pathname} />
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
      {canManageSite && (
        <SidebarGroup>
          <SidebarGroupLabel>Site Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {siteItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.href === "/portal/site-settings"
                      ? pathname === item.href
                      : isActivePath(pathname, item.href)}
                  >
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
      )}
    </>
  );
}
