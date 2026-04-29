import { defineSeed } from "../_factory";
import {
  assertAcademicLevelAllowedForProgram,
  getAllowedAcademicLevelKeysForProgram,
  uniqueStrings,
} from "./_helpers";
import { seedBranches } from "./branches";

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
    keyPrefix: "fair-bsoa",
    codePrefix: "FAIR-BSOA",
    namePrefix: "BSOA",
    branchKey: "fairview",
    programKey: "bsoa",
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
    keyPrefix: "val-gas",
    codePrefix: "VAL-GAS",
    namePrefix: "GAS",
    branchKey: "valenzuela",
    programKey: "shs-gas",
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
  down: async ({ prisma, getId }, rows) => {
    const branchSlugs = uniqueStrings(
      rows.map((row) =>
        getSeedReference(branchSlugByKey, row.branchKey, "branch")
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

    const branchIdBySlug = new Map(
      branches.map((branch) => [branch.slug, branch.id] as const)
    );

    const predicates = rows.flatMap((row) => {
      const branchSlug = getSeedReference(
        branchSlugByKey,
        row.branchKey,
        "branch"
      );
      const branchId = branchIdBySlug.get(branchSlug);

      if (branchId === undefined) {
        return [];
      }

      return [
        {
          branchId,
          programId: getId("programs", row.programKey, "program"),
          academicLevelsId: getId(
            "academicLevels",
            row.academicLevelKey,
            "academic level"
          ),
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
