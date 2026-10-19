import { requireAdmin } from "@/lib/auth";
import { applicationStatusOrder } from "@/lib/admission/status";
import { ApplicationStatus, LastSchoolVerificationStatus, UserRole } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { formatStudentName } from "@/lib/utils";

export type AdminDashboardData = {
  canManageAcademics: boolean;
  counts: {
    pendingAdmissions: number;
    approvedAdmissions: number;
    portalAccounts: number;
    pendingSchools: number;
  };
  admissionStatuses: Array<{ status: ApplicationStatus; count: number }>;
  recentApplications: Array<{
    id: string;
    name: string;
    program: string;
    branch: string;
    status: ApplicationStatus;
    createdAt: string;
  }>;
  academics: { classes: number; programs: number; subjects: number } | null;
};

export async function getAdminDashboard(): Promise<AdminDashboardData> {
  const session = await requireAdmin();
  const canManageAcademics = session.role === UserRole.superAdmin;
  const [statusGroups, recentApplications, portalAccounts, pendingSchools, academics] = await Promise.all([
    prisma.admissionApplication.groupBy({
      by: ["applicationStatus"],
      _count: { _all: true },
    }),
    prisma.admissionApplication.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        applicationStatus: true,
        createdAt: true,
        student: { select: { firstName: true, middleName: true, lastName: true, suffix: true } },
        program: { select: { code: true, label: true } },
        branch: { select: { title: true } },
      },
    }),
    prisma.user.count({ where: { role: { not: UserRole.superAdmin } } }),
    prisma.lastSchool.count({ where: { verificationStatus: LastSchoolVerificationStatus.pending } }),
    canManageAcademics
      ? Promise.all([
        prisma.class.count({ where: { teacher: { user: { role: { not: UserRole.superAdmin } } } } }),
        prisma.program.count(),
        prisma.subject.count(),
      ]).then(([classes, programs, subjects]) => ({ classes, programs, subjects }))
      : Promise.resolve(null),
  ]);
  const countsByStatus = new Map(statusGroups.map((group) => [group.applicationStatus, group._count._all]));
  const statusCount = (status: ApplicationStatus) => countsByStatus.get(status) ?? 0;

  return {
    canManageAcademics,
    counts: {
      pendingAdmissions: statusCount(ApplicationStatus.submitted) + statusCount(ApplicationStatus.reviewing) + statusCount(ApplicationStatus.updated),
      approvedAdmissions: statusCount(ApplicationStatus.approved),
      portalAccounts,
      pendingSchools,
    },
    admissionStatuses: applicationStatusOrder.map((status) => ({ status, count: statusCount(status) })),
    recentApplications: recentApplications.map((application) => ({
      id: application.id.toString(),
      name: formatStudentName(application.student),
      program: `${application.program.code} — ${application.program.label}`,
      branch: application.branch.title,
      status: application.applicationStatus,
      createdAt: application.createdAt.toISOString(),
    })),
    academics,
  };
}
