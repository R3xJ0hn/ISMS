import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, BookOpen, Building2, ClipboardList, GraduationCap, Plus, Users } from "lucide-react";
import { PortalEmptyState, PortalPageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { ApplicationStatus } from "@/lib/generated/prisma/enums";
import { getApplicationStatusLabel } from "@/lib/admission/status";
import { getAdminDashboard } from "@/lib/portal/dashboard";
import { getInitials } from "@/lib/utils";
import { ClassReviewReport } from "./class-review-report";
import { AdmissionUpdateNotifications } from "./admission-update-notifications";

export const metadata = { title: "Dashboard | ISMS" };

const statusAppearance = {
  [ApplicationStatus.draft]: { badge: "bg-slate-100 text-slate-600", bar: "bg-slate-400" },
  [ApplicationStatus.submitted]: { badge: "bg-blue-50 text-blue-700", bar: "bg-blue-400" },
  [ApplicationStatus.reviewing]: { badge: "bg-amber-50 text-amber-800", bar: "bg-amber-400" },
  [ApplicationStatus.updated]: { badge: "bg-violet-50 text-violet-700", bar: "bg-violet-400" },
  [ApplicationStatus.approved]: { badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-400" },
  [ApplicationStatus.rejected]: { badge: "bg-rose-50 text-rose-700", bar: "bg-rose-400" },
};

const dateFormatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const numberFormatter = new Intl.NumberFormat("en-PH");

export default async function AdminDashboardPage() {
  const { counts, recentApplications, admissionStatuses, canManageAcademics, academics } = await getAdminDashboard();
  const totalApplications = admissionStatuses.reduce((total, item) => total + item.count, 0);
  const metrics = [
    { title: "Admissions to review", value: counts.pendingAdmissions, description: "Submitted, under review, and updated", href: "/portal/admission", icon: ClipboardList, color: "bg-amber-50 text-amber-700" },
    { title: "Approved students", value: counts.approvedAdmissions, description: "Approved admission records", href: "/portal/students", icon: GraduationCap, color: "bg-emerald-50 text-emerald-700" },
    { title: "Portal accounts", value: counts.portalAccounts, description: "Student and staff accounts", href: "/portal/users", icon: Users, color: "bg-blue-50 text-blue-700" },
    { title: "School suggestions", value: counts.pendingSchools, description: "Schools awaiting verification", href: "/portal/last-schools", icon: Building2, color: "bg-violet-50 text-violet-700" },
  ];

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
      <PortalPageHeader label="Administration" title="Dashboard" description="An overview of admissions, student records, and school activity.">
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link href="/portal/admission"><ClipboardList aria-hidden="true" />Review admissions</Link></Button>
          {canManageAcademics && <Button asChild><Link href="/portal/classes/new"><Plus aria-hidden="true" />Add class</Link></Button>}
        </div>
      </PortalPageHeader>

      <section aria-label="School overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ title, value, description, href, icon: Icon, color }) => (
          <Link key={href} href={href} className="group min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex rounded-xl p-2.5 ${color}`}><Icon className="size-5" aria-hidden="true" /></span>
              <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight">{numberFormatter.format(value)}</p>
            <h2 className="mt-1 text-sm font-medium">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </section>

      <Suspense fallback={<p role="status" className="text-sm text-muted-foreground">Loading student updates...</p>}>
        <AdmissionUpdateNotifications />
      </Suspense>

      {canManageAcademics && <ClassReviewReport />}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-labelledby="recent-applications-heading" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 id="recent-applications-heading" className="font-semibold">Recent applications</h2>
              <p className="mt-1 text-xs text-muted-foreground">The latest five admission records</p>
            </div>
            <Link href="/portal/admission" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">View all<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </div>
          {recentApplications.length ? (
            <ul className="divide-y divide-border">
              {recentApplications.map((application) => {
                const appearance = statusAppearance[application.status];
                return (
                  <li key={application.id}>
                    <Link href={application.status === ApplicationStatus.approved ? `/portal/students/${application.id}` : `/portal/admission/${application.id}/edit`} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground" aria-hidden="true">{getInitials(application.name)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="min-w-0 break-words text-sm font-medium">{application.name}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${appearance.badge}`}>{getApplicationStatusLabel(application.status)}</span>
                        </div>
                        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{application.program}</p>
                        <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="break-words">{application.branch}</span>
                          <time dateTime={application.createdAt}>{dateFormatter.format(new Date(application.createdAt))}</time>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <PortalEmptyState title="No applications yet" description="New admissions will appear here once an applicant submits or an administrator adds a record." />}
        </section>

        <section aria-labelledby="admission-overview-heading" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="admission-overview-heading" className="font-semibold">Admission overview</h2>
          <p className="mt-1 text-xs text-muted-foreground">{numberFormatter.format(totalApplications)} total applications</p>
          <div className="mt-6 space-y-5">
            {admissionStatuses.map(({ status, count }) => {
              const appearance = statusAppearance[status];
              const percentage = totalApplications ? (count / totalApplications) * 100 : 0;
              return (
                <div key={status}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span>{getApplicationStatusLabel(status)}</span>
                    <span className="font-semibold tabular-nums">{numberFormatter.format(count)}</span>
                  </div>
                  <div role="meter" aria-label={getApplicationStatusLabel(status)} aria-valuenow={count} aria-valuemin={0} aria-valuemax={totalApplications || 1} aria-valuetext={`${count} of ${totalApplications} applications`} className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${appearance.bar}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">Submitted, under-review, and updated applications are ready for an administrator to check. Drafts are still being prepared.</p>
        </section>
      </div>

      {canManageAcademics && academics && (
        <section aria-labelledby="academic-overview-heading" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="academic-overview-heading" className="font-semibold">Academic overview</h2>
          <p className="mt-1 text-xs text-muted-foreground">Manage the classes and subjects offered by your school.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { title: "Classes", count: academics.classes, href: "/portal/classes", icon: ClipboardList },
              { title: "Programs", count: academics.programs, href: "/portal/programs", icon: GraduationCap },
              { title: "Subjects", count: academics.subjects, href: "/portal/subjects", icon: BookOpen },
            ].map(({ title, count, href, icon: Icon }) => (
              <Link key={href} href={href} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex-1"><p className="text-lg font-semibold tabular-nums">{numberFormatter.format(count)}</p><p className="text-xs text-muted-foreground">{title}</p></div>
                <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
