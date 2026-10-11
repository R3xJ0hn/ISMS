import { cache } from "react";
import { BookMarked, GraduationCap, ToolCase } from "lucide-react";

import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const programSelect = {
  publicTitle: true,
  slug: true,
  publicCode: true,
  note: true,
  overview: true,
  focusAreas: true,
  pathways: true,
} as const;

const publicProgramWhere = {
  slug: { not: null },
  publicTitle: { not: null },
  publicCode: { not: null },
  overview: { not: null },
  groupId: { not: null },
} satisfies Prisma.ProgramWhereInput;

const groupSelect = {
  id: true,
  title: true,
  description: true,
  educationLevel: true,
  pathwayLabel: true,
  programs: {
    where: publicProgramWhere,
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: programSelect,
  },
} satisfies Prisma.ProgramGroupSelect;

type ProgramRecord = Prisma.ProgramGetPayload<{ select: typeof programSelect }>;
type GroupRecord = Prisma.ProgramGroupGetPayload<{ select: typeof groupSelect }>;

export type Program = {
  title: string;
  slug: string;
  code: string;
  note: string | null;
  overview: string;
  focusAreas: string[];
  pathways: string[];
};

export type ProgramGroup = Omit<GroupRecord, "programs"> & {
  programs: Program[];
  icon: typeof GraduationCap;
};

const groupIcons: Record<string, typeof GraduationCap> = {
  college: GraduationCap,
  "tvl-track": ToolCase,
  "academic-track": BookMarked,
};

function toPublicProgram(record: ProgramRecord): Program | undefined {
  if (record.slug === null || record.publicTitle === null || record.publicCode === null || record.overview === null) {
    return undefined;
  }

  return {
    title: record.publicTitle,
    code: record.publicCode,
    slug: record.slug,
    note: record.note,
    overview: record.overview,
    focusAreas: record.focusAreas,
    pathways: record.pathways,
  };
}

function toPublicGroup(group: GroupRecord): ProgramGroup {
  return {
    ...group,
    programs: group.programs.flatMap((record) => {
      const program = toPublicProgram(record);
      return program ? [program] : [];
    }),
    icon: groupIcons[group.id] ?? GraduationCap,
  };
}

export const getProgramGroups = cache(async (): Promise<ProgramGroup[]> => {
  const groups = await prisma.programGroup.findMany({
    where: { programs: { some: publicProgramWhere } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: groupSelect,
  });

  return groups.map(toPublicGroup);
});

export const getProgramBySlug = cache(async (
  slug: string
): Promise<{ program: Program; group: ProgramGroup } | undefined> => {
  const result = await prisma.program.findUnique({
    where: { slug },
    select: {
      ...programSelect,
      group: { select: groupSelect },
    },
  });

  if (!result) {
    return undefined;
  }

  const { group, ...program } = result;
  const publicProgram = toPublicProgram(program);

  if (!group || !publicProgram) {
    return undefined;
  }

  return { program: publicProgram, group: toPublicGroup(group) };
});
