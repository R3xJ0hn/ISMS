import { prisma } from "@/lib/prisma";
import type { AcademicLevelOption, BranchSummary, ProgramOption } from "@/lib/types/catalog";

export type AdmissionOptions = {
  branches: Array<Pick<BranchSummary, "id" | "title">>;
  programs: Array<Omit<ProgramOption, "academicLevels">>;
  academicLevels: Array<Omit<AcademicLevelOption, "slug"> & { slug?: string }>;
};

export type AdmissionEditOptions = AdmissionOptions & {
  academicLevels: AcademicLevelOption[];
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
