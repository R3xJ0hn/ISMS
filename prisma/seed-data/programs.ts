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
    key: "bsoa",
    programTypeId: 1n,
    code: "BSOA",
    label: "Bachelor of Science in Office Administration",
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
    key: "bstm",
    programTypeId: 1n,
    code: "BSTM",
    label: "Bachelor of Science in Tourism Management",
    programType: ProgramType.Bachelor,
  },
  {
    key: "shs-ict",
    programTypeId: 2n,
    code: "SHS-ICT",
    label: "Information and Communications Technology",
    programType: ProgramType.SeniorHigh,
  },
  {
    key: "shs-he",
    programTypeId: 2n,
    code: "SHS-HE",
    label: "Home Economics",
    programType: ProgramType.SeniorHigh,
  },
  {
    key: "shs-abm",
    programTypeId: 2n,
    code: "SHS-ABM",
    label: "Accountancy, Business and Management",
    programType: ProgramType.SeniorHigh,
  },
  {
    key: "shs-gas",
    programTypeId: 2n,
    code: "SHS-GAS",
    label: "General Academic Strand",
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

const legacyProgramCodes = ["BSBA", "SHS-STEM"] as const;

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
      in: [...rows.map((row) => row.code), ...legacyProgramCodes],
    },
  }),
});
