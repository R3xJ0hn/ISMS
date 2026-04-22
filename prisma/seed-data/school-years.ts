import { defineSeed } from "../_factory";

type SchoolYearSeedRow = {
  key: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export const seedSchoolYears = [
  {
    key: "2023-2024",
    name: "2023-2024",
    startDate: "2023-08-07",
    endDate: "2024-05-31",
    isActive: false,
  },
  {
    key: "2024-2025",
    name: "2024-2025",
    startDate: "2024-08-05",
    endDate: "2025-05-30",
    isActive: false,
  },
  {
    key: "2025-2026",
    name: "2025-2026",
    startDate: "2025-08-04",
    endDate: "2026-05-29",
    isActive: true,
  },
] as const satisfies readonly SchoolYearSeedRow[];

export default defineSeed({
  table: "schoolYear",
  order: 50,
  rows: seedSchoolYears,
  idGroup: "schoolYears",
  getRowKey: (row) => row.key,
  create: async ({ prisma, dateOnly }, { key: _key, startDate, endDate, ...row }) =>
    prisma.schoolYear.create({
      data: {
        ...row,
        startDate: dateOnly(startDate),
        endDate: dateOnly(endDate),
      },
    }),
  deleteWhere: (rows) => ({
    name: {
      in: rows.map((row) => row.name),
    },
  }),
});
