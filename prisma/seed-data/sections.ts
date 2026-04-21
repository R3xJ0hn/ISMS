import { defineSeed } from "../_factory";

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

export default defineSeed({
  table: "section",
  order: 60,
  rows: seedSections,
  idGroup: "sections",
  getRowKey: (row) => row.key,
  create: async (
    { prisma, getId },
    { key: _key, branchKey, programKey, academicLevelKey, ...row }
  ) =>
    prisma.section.create({
      data: {
        ...row,
        branchId: getId("branches", branchKey, "branch"),
        programId: getId("programs", programKey, "program"),
        academicLevelsId: getId(
          "academicLevels",
          academicLevelKey,
          "academic level"
        ),
      },
    }),
  deleteWhere: (rows) => ({
    sectionCode: {
      in: rows.map((row) => row.sectionCode),
    },
  }),
});
