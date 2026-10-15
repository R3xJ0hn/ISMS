import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ClassroomPortal } from "@/components/classroom/classroom-portal";
import { PortalToastProvider } from "@/components/portal/toasts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { requireSession } from "@/lib/auth";
import { classroomTheme, portalTheme } from "@/lib/portal/theme";

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireSession();
  if (session.role === "teacher" || session.role === "student") {
    return (
      <div style={classroomTheme} className="min-h-svh bg-background text-foreground">
        <PortalToastProvider>
          <ClassroomPortal session={{ id: session.id, email: session.email, role: session.role }}>{children}</ClassroomPortal>
        </PortalToastProvider>
      </div>
    );
  }
  return (
    <SidebarProvider style={portalTheme}>
      <PortalToastProvider>
        <AppSidebar session={session} />
        <SidebarInset className="min-w-0 bg-background">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/95 transition-[width,height] ease-linear backdrop-blur-sm group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbLink href="/portal">Portal</BreadcrumbLink>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          {children}
        </SidebarInset>
      </PortalToastProvider>
    </SidebarProvider>
  );
}
