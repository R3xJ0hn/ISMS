import { defineSeed } from "../_factory";
import { ProgramType } from "../../lib/generated/prisma/enums";

type ProgramSeedRow = {
  key: string;
  programTypeId: bigint;
  code: string;
  label: string;
  programType: (typeof ProgramType)[keyof typeof ProgramType];
};

export const seedPrograms = [
  {
    key: "bsit",
    programTypeId: 1n,
    code: "BSIT",
    label: "Bachelor of Science in Information Technology",
    programType: ProgramType.Bachelor,
  },
  {
    key: "bsba",
    programTypeId: 1n,
    code: "BSBA",
    label: "Bachelor of Science in Business Administration",
    programType: ProgramType.Bachelor,
  },
  {
    key: "bshm",
    programTypeId: 1n,
    code: "BSHM",
    label: "Bachelor of Science in Hospitality Management",
    programType: ProgramType.Bachelor,
  },
  {
    key: "shs-stem",
    programTypeId: 2n,
    code: "SHS-STEM",
    label: "Senior High School - STEM",
    programType: ProgramType.SeniorHigh,
  },
  {
    key: "act",
    programTypeId: 3n,
    code: "ACT",
    label: "Associate in Computer Technology",
    programType: ProgramType.Associate,
  },
] as const satisfies readonly ProgramSeedRow[];

export default defineSeed({
  table: "program",
  order: 40,
  rows: seedPrograms,
  idGroup: "programs",
  getRowKey: (row) => row.key,
  create: async ({ prisma }, { key: _key, ...data }) =>
    prisma.program.create({ data }),
  deleteWhere: (rows) => ({
    code: {
      in: rows.map((row) => row.code),
    },
  }),
});
