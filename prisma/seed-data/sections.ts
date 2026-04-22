import { defineSeed } from "../_factory";
import { uniqueStrings } from "./_helpers";
import { seedAcademicLevels } from "./academic-levels";
import { seedBranches } from "./branches";
import { seedPrograms } from "./programs";

type SectionSeedRow = {
  key: string;
  branchKey: string;
  programKey: string;
  academicLevelKey: string;
  sectionCode: string;
  sectionName: string;
};

export const seedSections = [
  {
    key: "mey-bsit-2a",
    branchKey: "meycauayan",
    programKey: "bsit",
    academicLevelKey: "second-year",
    sectionCode: "MEY-BSIT-2A",
    sectionName: "BSIT 2-A",
  },
  {
    key: "fair-bsba-1a",
    branchKey: "fairview",
    programKey: "bsba",
    academicLevelKey: "first-year",
    sectionCode: "FAIR-BSBA-1A",
    sectionName: "BSBA 1-A",
  },
  {
    key: "cal-bshm-3a",
    branchKey: "caloocan",
    programKey: "bshm",
    academicLevelKey: "third-year",
    sectionCode: "CAL-BSHM-3A",
    sectionName: "BSHM 3-A",
  },
  {
    key: "val-stem-11a",
    branchKey: "valenzuela",
    programKey: "shs-stem",
    academicLevelKey: "grade-11",
    sectionCode: "VAL-STEM-11A",
    sectionName: "STEM 11-A",
  },
  {
    key: "mey-act-1b",
    branchKey: "meycauayan",
    programKey: "act",
    academicLevelKey: "first-year",
    sectionCode: "MEY-ACT-1B",
    sectionName: "ACT 1-B",
  },
] as const satisfies readonly SectionSeedRow[];

const branchSlugByKey = new Map(
  seedBranches.map((row) => [row.key, row.slug] as const)
);
const programCodeByKey = new Map(
  seedPrograms.map((row) => [row.key, row.code] as const)
);
const academicLevelSlugByKey = new Map(
  seedAcademicLevels.map((row) => [row.key, row.slug] as const)
);

function getSeedReference(
  lookup: ReadonlyMap<string, string>,
  key: string,
  label: string
) {
  const value = lookup.get(key);

  if (!value) {
    throw new Error(`Missing seeded ${label}: ${key}`);
  }

  return value;
}

export default defineSeed({
  table: "section",
  order: 60,
  rows: seedSections,
  idGroup: "sections",
  getRowKey: (row) => row.key,
  create: async ({ prisma, getId }, row) =>
    prisma.section.create({
      data: {
        sectionCode: row.sectionCode,
        sectionName: row.sectionName,
        branchId: getId("branches", row.branchKey, "branch"),
        programId: getId("programs", row.programKey, "program"),
        academicLevelsId: getId(
          "academicLevels",
          row.academicLevelKey,
          "academic level"
        ),
      },
    }),
  down: async ({ prisma }, rows) => {
    const branchSlugs = uniqueStrings(
      rows.map((row) =>
        getSeedReference(branchSlugByKey, row.branchKey, "branch")
      )
    );
    const programCodes = uniqueStrings(
      rows.map((row) =>
        getSeedReference(programCodeByKey, row.programKey, "program")
      )
    );
    const academicLevelSlugs = uniqueStrings(
      rows.map((row) =>
        getSeedReference(
          academicLevelSlugByKey,
          row.academicLevelKey,
          "academic level"
        )
      )
    );

    const branches = await prisma.branch.findMany({
      where: {
        slug: {
          in: branchSlugs,
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });
    const programs = await prisma.program.findMany({
      where: {
        code: {
          in: programCodes,
        },
      },
      select: {
        code: true,
        id: true,
      },
    });
    const academicLevels = await prisma.academicLevels.findMany({
      where: {
        slug: {
          in: academicLevelSlugs,
        },
      },
      select: {
        id: true,
        slug: true,
      },
    });

    const branchIdBySlug = new Map(
      branches.map((branch) => [branch.slug, branch.id] as const)
    );
    const programIdByCode = new Map(
      programs.map((program) => [program.code, program.id] as const)
    );
    const academicLevelIdBySlug = new Map(
      academicLevels.map((level) => [level.slug, level.id] as const)
    );

    const predicates = rows.flatMap((row) => {
      const branchSlug = getSeedReference(
        branchSlugByKey,
        row.branchKey,
        "branch"
      );
      const programCode = getSeedReference(
        programCodeByKey,
        row.programKey,
        "program"
      );
      const academicLevelSlug = getSeedReference(
        academicLevelSlugByKey,
        row.academicLevelKey,
        "academic level"
      );
      const branchId = branchIdBySlug.get(branchSlug);
      const programId = programIdByCode.get(programCode);
      const academicLevelsId = academicLevelIdBySlug.get(academicLevelSlug);

      if (
        branchId === undefined ||
        programId === undefined ||
        academicLevelsId === undefined
      ) {
        return [];
      }

      return [
        {
          branchId,
          programId,
          academicLevelsId,
          sectionCode: row.sectionCode,
        },
      ];
    });

    if (predicates.length === 0) {
      return;
    }

    await prisma.section.deleteMany({
      where: {
        OR: predicates,
      },
    });
  },
});
