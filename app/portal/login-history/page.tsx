import { redirect } from "next/navigation";

import { BadgeCheck, Clock, Globe2, Monitor, ShieldCheck } from "lucide-react";

import { formatRoleLabel, getCurrentSession } from "@/lib/auth";
import { UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 100;

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatDateTime(value: Date) {
  return dateTimeFormatter.format(value);
}

function getDeviceLabel(userAgent: string | null) {
  if (!userAgent) {
    return "Unknown device";
  }

  if (/iphone|ipad|android|mobile/i.test(userAgent)) {
    return "Mobile browser";
  }

  if (/windows|macintosh|linux/i.test(userAgent)) {
    return "Desktop browser";
  }

  return "Browser";
}

export default async function LoginHistoryPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const isAdmin =
    session.role === UserRole.admin || session.role === UserRole.superAdmin;
  const userId = /^\d+$/.test(session.id) ? BigInt(session.id) : null;

  const loginHistory = await prisma.loginHistory.findMany({
    where: isAdmin
      ? undefined
      : {
          userId: userId ?? BigInt(0),
        },
    orderBy: {
      createdAt: "desc",
    },
    take: PAGE_SIZE,
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShieldCheck className="size-4" />
          Access records
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">
              Login History
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Latest successful portal sign-ins.
            </p>
          </div>
          <div className="flex w-fit items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Last {PAGE_SIZE} entries
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-1 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase text-muted-foreground md:grid-cols-[1.25fr_0.75fr_1fr_1fr_1.1fr]">
          <span>User</span>
          <span>Role</span>
          <span>Signed in</span>
          <span>IP address</span>
          <span>Device</span>
        </div>

        {loginHistory.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 text-center">
            <BadgeCheck className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              No login history yet
            </p>
            <p className="text-sm text-muted-foreground">
              Successful sign-ins will appear here after users log in.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {loginHistory.map((entry) => (
              <div
                key={entry.id.toString()}
                className="grid grid-cols-1 gap-2 px-4 py-4 text-sm md:grid-cols-[1.25fr_0.75fr_1fr_1fr_1.1fr] md:items-center md:gap-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {entry.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    User #{entry.userId.toString()}
                  </p>
                </div>
                <p className="text-muted-foreground">
                  {formatRoleLabel(entry.role)}
                </p>
                <p className="text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </p>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Globe2 className="size-4 shrink-0" />
                  <span>{entry.ipAddress ?? "Unknown"}</span>
                </div>
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Monitor className="size-4 shrink-0" />
                  <span className="truncate" title={entry.userAgent ?? undefined}>
                    {getDeviceLabel(entry.userAgent)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
