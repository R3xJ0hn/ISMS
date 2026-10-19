import "server-only";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@/lib/generated/prisma/client";
import { NotificationType, type ApplicationStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatStudentName } from "@/lib/utils";

export type DashboardNotification = {
  id: string;
  applicationId: string;
  applicationStatus: ApplicationStatus;
  studentName: string;
  program: string;
  branch: string;
  createdAt: string;
};

/** Call inside the authorized student save transaction so the event cannot outlive a failed save. */
export async function createAdmissionUpdatedNotification(tx: Prisma.TransactionClient, {
  applicationId, actorUserId,
}: { applicationId: bigint; actorUserId: bigint }): Promise<void> {
  await tx.notification.create({
    data: { type: NotificationType.admissionUpdated, applicationId, actorUserId },
    select: { id: true },
  });
}

/** Shared admin activity feed: identities come from the saved admission, without storing duplicate personal data. */
export async function getDashboardNotifications(): Promise<{
  notifications: DashboardNotification[];
  unavailable: boolean;
}> {
  await requireAdmin();
  try {
    const notifications = await prisma.notification.findMany({
      where: { type: NotificationType.admissionUpdated },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true, createdAt: true,
        application: { select: {
          id: true, applicationStatus: true,
          student: { select: { firstName: true, middleName: true, lastName: true, suffix: true } },
          program: { select: { code: true, label: true } },
          branch: { select: { title: true } },
        } },
      },
    });
    return {
      notifications: notifications.map(({ id, createdAt, application }) => ({
        id: id.toString(), applicationId: application.id.toString(),
        applicationStatus: application.applicationStatus,
        studentName: formatStudentName(application.student),
        program: `${application.program.code} — ${application.program.label}`,
        branch: application.branch.title, createdAt: createdAt.toISOString(),
      })),
      unavailable: false,
    };
  } catch {
    console.error("Unable to load dashboard notifications.");
    return { notifications: [], unavailable: true };
  }
}
