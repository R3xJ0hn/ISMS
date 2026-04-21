import { defineSeed } from "../_factory";
import { SchoolType } from "../../lib/generated/prisma/enums";
import { findLastSchoolIdsByNames } from "./_helpers";

type LastSchoolSeedRow = {
  key: string;
  schoolName: string;
  schoolId: string | null;
  shortName: string | null;
  addressKey: string | null;
  schoolType: (typeof SchoolType)[keyof typeof SchoolType];
};

export const seedLastSchools = [
  {
    key: "meycauayan-national-high",
    schoolName: "Meycauayan National High School",
    schoolId: "MNHS-3020",
    shortName: "MNHS",
    addressKey: null,
    schoolType: SchoolType.Public,
  },
  {
    key: "commonwealth-senior-high",
    schoolName: "Commonwealth Senior High School",
    schoolId: "CSHS-1121",
    shortName: "CSHS",
    addressKey: null,
    schoolType: SchoolType.Public,
  },
  {
    key: "caloocan-business-high",
    schoolName: "Caloocan City Business High School",
    schoolId: "CCBHS-1400",
    shortName: "CCBHS",
    addressKey: null,
    schoolType: SchoolType.Public,
  },
  {
    key: "valenzuela-senior-high",
    schoolName: "Valenzuela Senior High School",
    schoolId: "VSHS-1440",
    shortName: "VSHS",
    addressKey: null,
    schoolType: SchoolType.Public,
  },
  {
    key: "datamex-institute-tech",
    schoolName: "Datamex Institute of Computer Technology",
    schoolId: "DICT-1470",
    shortName: "DICT",
    addressKey: null,
    schoolType: SchoolType.Private,
  },
] as const satisfies readonly LastSchoolSeedRow[];

export default defineSeed({
  table: "lastSchool",
  order: 110,
  rows: seedLastSchools,
  idGroup: "lastSchools",
  getRowKey: (row) => row.key,
  create: async ({ prisma, getId }, { key: _key, addressKey, ...row }) =>
    prisma.lastSchool.create({
      data: {
        ...row,
        addressId: addressKey
          ? getId("addresses", addressKey, "address")
          : null,
      },
    }),
  down: async ({ prisma }, rows) => {
    const schoolIds = await findLastSchoolIdsByNames(
      prisma,
      rows.map((row) => row.schoolName)
    );

    if (schoolIds.length === 0) {
      return;
    }

    await prisma.lastSchool.deleteMany({
      where: {
        id: {
          in: schoolIds,
        },
      },
    });
  },
});
