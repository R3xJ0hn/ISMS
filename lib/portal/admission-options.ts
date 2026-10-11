import { prisma } from "@/lib/prisma";

export type AdmissionOptions = {
  branches: Array<{ id: string; title: string }>;
  programs: Array<{ id: string; code: string; label: string; programType: string }>;
  academicLevels: Array<{ id: string; label: string; slug?: string }>;
};

export type AdmissionEditOptions = AdmissionOptions & {
  academicLevels: Array<{ id: string; label: string; slug: string }>;
};

export async function getPortalAdmissionOptions(includeSlugs: true): Promise<AdmissionEditOptions>;
export async function getPortalAdmissionOptions(includeSlugs?: false): Promise<AdmissionOptions>;
export async function getPortalAdmissionOptions(includeSlugs = false) {
  const [branches, programs, academicLevels] = await Promise.all([
    prisma.branch.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.program.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, label: true, programType: true },
    }),
    prisma.academicLevels.findMany({
      orderBy: { id: "asc" },
      select: { id: true, label: true, slug: includeSlugs },
    }),
  ]);

  const serializeId = <T extends { id: bigint }>(record: T) => ({ ...record, id: record.id.toString() });
  return {
    branches: branches.map(serializeId),
    programs: programs.map(serializeId),
    academicLevels: academicLevels.map(serializeId),
  };
}
