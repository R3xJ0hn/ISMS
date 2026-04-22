import { defineSeed } from "../_factory";
import {
  assertAcademicLevelAllowedForProgram,
  getAllowedAcademicLevelKeysForProgram,
  uniqueStrings,
} from "./_helpers";
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

type SectionOffering = {
  keyPrefix: string;
  codePrefix: string;
  namePrefix: string;
  branchKey: string;
  programKey: string;
  sectionSuffix: string;
};

const levelCodeByAcademicLevelKey: Record<string, string> = {
  "grade-11": "11",
  "grade-12": "12",
  "first-year": "1",
  "second-year": "2",
  "third-year": "3",
  "fourth-year": "4",
};

const seedSectionOfferings = [
  {
    keyPrefix: "mey-bsit",
    codePrefix: "MEY-BSIT",
    namePrefix: "BSIT",
    branchKey: "meycauayan",
    programKey: "bsit",
    sectionSuffix: "A",
  },
  {
    keyPrefix: "fair-bsba",
    codePrefix: "FAIR-BSBA",
    namePrefix: "BSBA",
    branchKey: "fairview",
    programKey: "bsba",
    sectionSuffix: "A",
  },
  {
    keyPrefix: "cal-bshm",
    codePrefix: "CAL-BSHM",
    namePrefix: "BSHM",
    branchKey: "caloocan",
    programKey: "bshm",
    sectionSuffix: "A",
  },
  {
    keyPrefix: "val-stem",
    codePrefix: "VAL-STEM",
    namePrefix: "STEM",
    branchKey: "valenzuela",
    programKey: "shs-stem",
    sectionSuffix: "A",
  },
  {
    keyPrefix: "mey-act",
    codePrefix: "MEY-ACT",
    namePrefix: "ACT",
    branchKey: "meycauayan",
    programKey: "act",
    sectionSuffix: "B",
  },
] as const satisfies readonly SectionOffering[];

export const seedSections: readonly SectionSeedRow[] = seedSectionOfferings.flatMap(
  (offering) => {
    const levelKeys = getAllowedAcademicLevelKeysForProgram(offering.programKey);
    const sectionSuffix = offering.sectionSuffix.toUpperCase();

    return levelKeys.map((academicLevelKey) => {
      const levelCode = levelCodeByAcademicLevelKey[academicLevelKey];

      if (!levelCode) {
        throw new Error(`Missing section level code for ${academicLevelKey}.`);
      }

      return {
        key: `${offering.keyPrefix}-${levelCode.toLowerCase()}${sectionSuffix.toLowerCase()}`,
        branchKey: offering.branchKey,
        programKey: offering.programKey,
        academicLevelKey,
        sectionCode: `${offering.codePrefix}-${levelCode}${sectionSuffix}`,
        sectionName: `${offering.namePrefix} ${levelCode}-${sectionSuffix}`,
      };
    });
  }
);

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
  create: async ({ prisma, getId }, row) => {
    assertAcademicLevelAllowedForProgram(
      row.programKey,
      row.academicLevelKey,
      `Section "${row.key}"`
    );

    return prisma.section.create({
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
    });
  },
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
