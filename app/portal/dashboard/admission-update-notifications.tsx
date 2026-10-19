import Link from "next/link";
import { ArrowUpRight, Bell } from "lucide-react";
import { PortalEmptyState } from "@/components/portal/page-header";
import { getDashboardNotifications } from "@/lib/notifications";
import { ApplicationStatus } from "@/lib/generated/prisma/enums";

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
});

/** Persisted student updates are shared by authorized administrative accounts. */
export async function AdmissionUpdateNotifications() {
  const { notifications, unavailable } = await getDashboardNotifications();
  return (
    <section aria-labelledby="admission-updates-heading" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h2 id="admission-updates-heading" className="flex items-center gap-2 font-semibold"><Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />Student updates</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">The latest 10 admission information updates submitted by students</p>
        </div>
        <Link href="/portal/admission" className="inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Review admissions<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
      </div>
      {unavailable ? (
        <p role="status" className="p-5 text-sm text-muted-foreground">Student updates are unavailable right now. Refresh the dashboard to try again.</p>
      ) : notifications.length ? (
        <ul className="divide-y divide-border">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <Link href={notification.applicationStatus === ApplicationStatus.approved ? `/portal/students/${notification.applicationId}` : `/portal/admission/${notification.applicationId}/edit`} className="flex min-w-0 flex-col gap-2 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="wrap-anywhere text-sm font-medium">{notification.studentName}</h3>
                  <p className="mt-1 text-sm text-violet-700">Admission information updated</p>
                  <p className="mt-1 wrap-anywhere text-xs leading-5 text-muted-foreground">{notification.program} · {notification.branch}</p>
                </div>
                <time dateTime={notification.createdAt} className="shrink-0 text-xs leading-5 text-muted-foreground">{dateFormatter.format(new Date(notification.createdAt))}</time>
              </Link>
            </li>
          ))}
        </ul>
      ) : <PortalEmptyState title="No student updates yet" description="Updates appear here after a student saves their admission review information." />}
    </section>
  );
}
