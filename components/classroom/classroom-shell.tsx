"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog, DropdownMenu } from "radix-ui";
import { ClipboardList, GraduationCap, House, LogOut, Menu, PanelLeftClose, UserRound, X } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials, isActivePath } from "@/lib/utils";
import { classroomTheme } from "@/lib/portal/theme";

export type ClassroomShellProps = {
  role: "teacher" | "student";
  displayName: string;
  email: string;
  avatarUrl: string | null;
  children: ReactNode;
};

export function ClassroomShell({ role, displayName, email, avatarUrl, children }: ClassroomShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavigationTrigger = useRef<HTMLButtonElement>(null);
  const classesHref = role === "teacher" ? "/portal/my-classes" : "/portal/classroom";
  const roleLabel = role === "teacher" ? "Teacher" : "Student";
  const links = [
    { title: "Classes", href: classesHref, icon: House },
    ...(role === "student" ? [{ title: "To-dos", href: "/portal/to-dos", icon: ClipboardList }] : []),
    ...(role === "student" ? [{ title: "My grades", href: "/portal/grades", icon: GraduationCap }] : []),
    { title: "My information", href: "/portal/information", icon: UserRound },
  ];

  function navigation(compact = false) {
    return (
      <nav aria-label="Classroom navigation" className="space-y-1 p-3">
        {links.map(({ title, href, icon: Icon }) => {
          const active = isActivePath(pathname, href);
          return (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} aria-current={active ? "page" : undefined}
              title={compact ? title : undefined}
              className={cn("flex min-h-12 items-center gap-4 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", compact && "justify-center px-0", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              <span className={compact ? "sr-only" : "truncate"}>{title}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  const iconButton = "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="min-h-svh bg-background text-foreground">
      <a href="#classroom-content" className="sr-only z-[110] rounded-md bg-card px-4 py-3 font-medium text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button ref={mobileNavigationTrigger} type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={mobileOpen} aria-controls="classroom-mobile-navigation" className={cn(iconButton, "lg:hidden")} onClick={() => setMobileOpen(true)}>
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Toggle navigation" aria-expanded={!collapsed} aria-controls="classroom-desktop-navigation" className={cn(iconButton, "hidden lg:inline-flex")} onClick={() => setCollapsed((current) => !current)}>
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <Link href={classesHref} className="flex min-w-0 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <GraduationCap className="size-7 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate text-lg font-semibold tracking-tight sm:text-xl">ISMS <span className="font-normal text-muted-foreground">Classroom</span></span>
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:inline-block">{roleLabel}</span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" aria-label="Open account menu" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <Avatar className="size-9"><AvatarImage src={avatarUrl ?? undefined} alt="" /><AvatarFallback className="bg-accent font-semibold text-accent-foreground">{getInitials(displayName)}</AvatarFallback></Avatar>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={12} style={classroomTheme} className="z-[80] w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-2 text-card-foreground shadow-lg">
                <div className="min-w-0 border-b border-border px-3 py-3"><p className="truncate text-sm font-semibold">{displayName}</p><p className="mt-1 break-all text-xs text-muted-foreground">{email}</p></div>
                <DropdownMenu.Item asChild><Link href="/portal/information" className="mt-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none focus:bg-muted"><UserRound className="size-4" aria-hidden="true" />My information</Link></DropdownMenu.Item>
                <form action={logoutAction}><DropdownMenu.Item asChild onSelect={(event) => event.preventDefault()}><button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"><LogOut className="size-4" aria-hidden="true" />Sign out</button></DropdownMenu.Item></form>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
      <aside id="classroom-desktop-navigation" className={cn("fixed bottom-0 left-0 top-16 hidden flex-col border-r border-border bg-card transition-[width] lg:flex", collapsed ? "w-20" : "w-64")}>
        {navigation(collapsed)}
        <div className="mt-auto border-t border-border p-3">
          {!collapsed && <p className="mb-3 px-4 text-xs text-muted-foreground">{roleLabel} workspace</p>}
          <button type="button" className={cn(iconButton, "w-full")} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((current) => !current)}><PanelLeftClose className={cn("size-5", collapsed && "rotate-180")} aria-hidden="true" /></button>
        </div>
      </aside>
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35" />
          <Dialog.Content id="classroom-mobile-navigation" style={classroomTheme} onCloseAutoFocus={(event) => { event.preventDefault(); mobileNavigationTrigger.current?.focus(); }} className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-card text-foreground shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-border px-4"><Dialog.Title className="font-semibold">ISMS Classroom</Dialog.Title><Dialog.Close asChild><button type="button" aria-label="Close navigation" className={iconButton}><X className="size-5" aria-hidden="true" /></button></Dialog.Close></div>
            <Dialog.Description className="sr-only">Open your classes and account pages.</Dialog.Description>
            {navigation()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div id="classroom-content" tabIndex={-1} className={cn("min-w-0 outline-none transition-[padding]", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        {children}
      </div>
    </div>
  );
}
