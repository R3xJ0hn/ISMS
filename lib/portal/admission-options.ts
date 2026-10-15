import { prisma } from "@/lib/prisma";
import type { AcademicLevelOption, BranchSummary, ProgramOption } from "@/lib/types/catalog";
import { academicLevelOptions } from "@/lib/academic-levels";

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
export async function getPortalAdmissionOptions(includeSlugs = false): Promise<AdmissionOptions | AdmissionEditOptions> {
  const [branches, programs] = await Promise.all([
    prisma.branch.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.program.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, label: true, programType: true },
    }),
  ]);

  const serializeId = <T extends { id: bigint }>(record: T) => ({ ...record, id: record.id.toString() });
  return {
    branches: branches.map(serializeId),
    programs: programs.map(serializeId),
    academicLevels: academicLevelOptions.map(({ value, label, slug }) => ({ value, label, ...(includeSlugs ? { slug } : {}) })),
  };
}
