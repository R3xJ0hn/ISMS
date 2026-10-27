import { ApplicationStatus } from "@/lib/generated/prisma/enums";

export const applicationStatusOrder = [
  ApplicationStatus.updated,
  ApplicationStatus.reviewing,
  ApplicationStatus.submitted,
  ApplicationStatus.draft,
  ApplicationStatus.rejected,
  ApplicationStatus.approved,
] as const;

const statusLabels: Record<ApplicationStatus, string> = {
  updated: "Updated", reviewing: "Review", submitted: "Submitted",
  draft: "Draft", rejected: "Rejected", approved: "Approved",
};
const statusRanks: Record<ApplicationStatus, number> = {
  updated: 0, reviewing: 1, submitted: 1, draft: 2, rejected: 3, approved: 4,
};

export function getApplicationStatusLabel(status: string) {
  return Object.hasOwn(statusLabels, status) ? statusLabels[status as ApplicationStatus] : status;
}

export function getApplicationStatusRank(status: string) {
  return Object.hasOwn(statusRanks, status) ? statusRanks[status as ApplicationStatus] : 5;
}
