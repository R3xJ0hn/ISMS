import { defineSeed } from "../_factory";

type AcademicLevelSeedRow = {
  key: string;
  label: string;
  slug: string;
};

export const seedAcademicLevels = [
  {
    key: "grade-11",
    label: "Grade 11",
    slug: "grade-11",
  },
  {
    key: "grade-12",
    label: "Grade 12",
    slug: "grade-12",
  },
  {
    key: "first-year",
    label: "First Year",
    slug: "first-year",
  },
  {
    key: "second-year",
    label: "Second Year",
    slug: "second-year",
  },
  {
    key: "third-year",
    label: "Third Year",
    slug: "third-year",
  },
  {
    key: "fourth-year",
    label: "Fourth Year",
    slug: "fourth-year",
  },
] as const satisfies readonly AcademicLevelSeedRow[];

export default defineSeed({
  table: "academicLevels",
  order: 30,
  rows: seedAcademicLevels,
  idGroup: "academicLevels",
  getRowKey: (row) => row.key,
  create: async ({ prisma }, row) =>
    prisma.academicLevels.create({
      data: {
        label: row.label,
        slug: row.slug,
      },
    }),
  deleteWhere: (rows) => ({
    slug: {
      in: rows.map((row) => row.slug),
    },
  }),
});
